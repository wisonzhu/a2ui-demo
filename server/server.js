import http from 'node:http';
import https from 'node:https';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, '..', '.tmp');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

function loadKey() {
  try {
    const env = readFileSync(join(__dirname, '..', '..', '..', '..', '.hermes', '.env'), 'utf8');
    const m = env.match(/DEEPSEEK_API_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || loadKey();

async function* aguiStream(prompt) {
  yield { type: 'RUN_STARTED', runId: crypto.randomUUID() };
  yield { type: 'TEXT_MESSAGE_START', messageId: 'msg-1', role: 'assistant' };
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], stream: true })
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta };
        } catch {}
      }
    }
  }
  yield { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' };
  yield { type: 'RUN_FINISHED', runId: '...' };
}

async function fetchRealData(source) {
  const { execSync } = await import('node:child_process');
  
  // System: local machine stats
  if (source === 'system') {
    const cpu = parseFloat(execSync("top -l 1 -n 0 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'", {encoding:'utf8'}).trim()) || 30;
    const mem = execSync("vm_stat | awk '/Pages active/ {a=$NF} /Pages wired/ {w=$NF} END {printf \"%.0f\", (a+w)*4096/1024/1024/1024/'" + (require('os').totalmem()/1024/1024/1024).toFixed(1) + "*100}", {encoding:'utf8'}).trim();
    const disk = execSync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", {encoding:'utf8'}).trim();
    const uptime = execSync("uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}'", {encoding:'utf8'}).trim();
    return `CPU: ${cpu}%, Memory: ${mem}%, Disk: ${disk}%, Uptime: ${uptime}`;
  }
  
  // K8s: pod/node count (if kubectl available)
  if (source === 'k8s') {
    try {
      const pods = execSync("kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l", {encoding:'utf8'}).trim();
      const nodes = execSync("kubectl get nodes --no-headers 2>/dev/null | wc -l", {encoding:'utf8'}).trim();
      const top = execSync("kubectl top nodes --no-headers 2>/dev/null | head -5", {encoding:'utf8'}).trim();
      return `Pods: ${pods}, Nodes: ${nodes}\nNode usage:\n${top}`;
    } catch(e) { return 'K8s not available: '+e.message; }
  }
  
  // Docker: container list
  if (source === 'docker') {
    try {
      const containers = execSync("docker ps --format '{{.Names}} {{.Status}}' --no-trunc 2>/dev/null | head -10", {encoding:'utf8'}).trim();
      return `Running containers:\n${containers}`;
    } catch(e) { return 'Docker not available'; }
  }
  
  // Git: recent commits
  if (source === 'git') {
    try {
      const log = execSync("git log --oneline -10 2>/dev/null", {encoding:'utf8'}).trim();
      return `Recent commits:\n${log}`;
    } catch(e) { return 'No git repo'; }
  }
  
  // Nginx: access stats
  if (source === 'nginx') {
    try {
      const stats = execSync("tail -1000 /usr/local/var/log/nginx/access.log 2>/dev/null | awk '{print $9}' | sort | uniq -c | sort -rn", {encoding:'utf8'}).trim();
      return `Nginx response codes:\n${stats}`;
    } catch(e) { return 'Nginx logs not found at default path'; }
  }
  
  return `Unknown data source: ${source}`;
}
async function a2uiGen(prompt) {
  const system = `You are an A2UI generator. Output ONLY a JSON object.

MUST use this EXACT structure:
{"surfaceUpdate":{"components":[{"id":"root","component":{"Column":{"children":["t1","f1","btn"]}}},{"id":"t1","component":{"Text":{"text":{"literalString":"Title"},"variant":"h2"}}},{"id":"f1","component":{"TextField":{"label":{"literalString":"Name"},"value":{"path":"/name"}}}},{"id":"btn","component":{"Button":{"child":"btnLbl","action":{"event":{"name":"submit"}}}}},{"id":"btnLbl","component":{"Text":{"text":{"literalString":"Submit"}}}}]}}

TABLE EXAMPLE:
{"id":"table1","component":{"Table":{"columns":["Name","Age","City"],"rows":[["Alice","25","NYC"],["Bob","30","LA"]]}}}

DATAGRID EXAMPLE:
{"id":"dg1","component":{"DataGrid":{"title":{"literalString":"Users"},"columns":[{"header":"Name","accessor":"name"},{"header":"Age","accessor":"age"}],"rows":[["Alice","25"],["Bob","30"]],"pageSize":10}}}

Official A2UI v0.9 components (use EXACT property names):
Text: component="Text", text, variant=h1|h2|h3|h4|h5|caption|body
TextField: component="TextField", label, value:{path:"/name"}, variant=short|long|password|number|email
Button: component="Button", child, variant, action
Card: component="Card", child (SINGLE component id!)
Row: component="Row", children:{explicitList:[...]}, justify, align
Column: component="Column", children:{explicitList:[...]}, justify, align
List: component="List", children:{explicitList:[...]}, direction
Image: component="Image", url, description(alt), fit
Icon: component="Icon", name
Tabs: component="Tabs", tabs:[{title, child}]  ← ONE array!
Modal: component="Modal", trigger(component id), content(component id)  ← NOT triggerText!
Divider: component="Divider", axis=horizontal|vertical
CheckBox: component="CheckBox", label, value:{path:"/..."}
ChoicePicker: component="ChoicePicker", label, options:[{label,value}], value:{path:"/..."}, displayStyle
Slider: component="Slider", label, min, max, value
DateTimeInput: component="DateTimeInput", value:{path:"/..."}, enableDate, enableTime, label

TABLE EXAMPLE: {"id":"t1","component":{"Table":{"columns":["Name","Age"],"rows":[["Alice","25"]]}}}
CHART EXAMPLE: {"id":"c1","component":{"Chart":{"chartType":"bar","title":{"literalString":"Sales"},"labels":["Q1","Q2"],"datasets":[{"label":"2024","data":[100,200]}]}}}
CUSTOM: Table(columns+rows), Chart(chartType+title+labels+datasets+imageBase64), Tag(text+type), StatCard(value+label+icon+trend), Badge(value+child), Progress(percent), Workflow(nodes:[{title,status}]), ApprovalFlow(steps:[{name,role,status,time}]), ProcessStep(items:[{title,status}])

Every component MUST have "id" and "component" fields. Output ONLY valid JSON, no markdown.`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 6000
    })
  });

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();
  console.error('DEEPSEEK raw:', cleaned.slice(0, 100));
  let ui;
  try { ui = JSON.parse(cleaned); console.error('PARSED OK:', Object.keys(ui).join(',')); }
  catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) try { ui = JSON.parse(match[0]); } catch { ui = {}; }
    else ui = {};
  }

  // Server-side chart rendering
  const comps = ui?.surfaceUpdate?.components || [];
  for (const c of comps) {
    const chart = c.component?.Chart;
    if (!chart) continue;
    try { chart.imageBase64 = renderChart(chart); }
    catch (e) { chart.error = e.message; }
  }
  return ui;
}

function renderChart(chart) {
  const id = Math.random().toString(36).slice(2, 8);
  const pyFile = join(tmpDir, 'chart_' + id + '.py');
  const pngFile = join(tmpDir, 'chart_' + id + '.png');

  // Flatten labels and datasets to plain strings/numbers
  const labels = (chart.labels || []).map(l => typeof l === 'string' ? l : (l.literalString || ''));
  const datasets = (chart.datasets || []).map(ds => ({
    label: typeof ds.label === 'string' ? ds.label : (ds.label?.literalString || ''),
    data: (ds.data || []).map(v => typeof v === 'number' ? v : parseInt(v) || 0)
  }));
  const chartType = chart.chartType || 'bar';
  const width = ((chart.sizes && chart.sizes.width) || 600) / 100;
  const height = ((chart.sizes && chart.sizes.height) || 400) / 100;

  const pyCode = `import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import json

for f in fm.fontManager.ttflist:
    if 'PingFang' in f.name:
        plt.rcParams['font.family'] = f.name
        break
plt.rcParams['axes.unicode_minus'] = False

labels = ` + JSON.stringify(labels) + `
datasets = ` + JSON.stringify(datasets) + `
chartType = "` + chartType + `"

fig, ax = plt.subplots(figsize=(${width}, ${height}))
fig.patch.set_facecolor('#0d1117')
ax.set_facecolor('#161b22')
ax.tick_params(colors='#c9d1d9')

if chartType == 'pie':
    wedges, texts, autotexts = ax.pie(datasets[0]['data'], labels=labels, autopct='%1.1f%%',
        colors=['#238636','#1f6feb','#d29922','#f85149','#a371f7','#3fb950'],
        textprops={'color':'#c9d1d9'})
else:
    for ds in datasets:
        if chartType == 'bar':
            ax.bar(labels, ds['data'], label=ds['label'])
        elif chartType == 'line':
            ax.plot(labels, ds['data'], marker='o', label=ds['label'])
    ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#c9d1d9')

ax.set_title("` + (chart.title?.literalString || chart.title || '') + `", color='#58a6ff', fontsize=12)
plt.tight_layout()
plt.savefig("` + pngFile + `", dpi=100, bbox_inches='tight', facecolor='#0d1117')
`;

  writeFileSync(pyFile, pyCode);
  const venvPython = join(dirname(dirname(dirname(__dirname))), 'finance-env', 'bin', 'python3');
  execSync('"' + venvPython + '" "' + pyFile + '"', { timeout: 15000 });
  const img = readFileSync(pngFile);
  return 'data:image/png;base64,' + img.toString('base64');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  // Auto-key endpoint for frontend
  if (url.pathname === '/a2ui/key') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({key:DEEPSEEK_KEY}));
    return;
  }

  if (url.pathname === '/agui/stream' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      const { prompt } = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      try { for await (const ev of aguiStream(prompt)) res.write('data: ' + JSON.stringify(ev) + '\n\n'); }
      catch (e) { res.write('data: ' + JSON.stringify({ type: 'ERROR', error: e.message }) + '\n\n'); }
      res.end();
    });
    return;
  }

  if (url.pathname === '/a2ui/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prompt, dataSource } = JSON.parse(body);
        
        // Fetch real data if dataSource specified
        let realData = '';
        if (dataSource) {
          try { realData = await fetchRealData(dataSource); } catch(e) { realData = 'Error: '+e.message; }
        }
        
        const fullPrompt = realData ? `真实数据:\n${realData}\n\n用户需求:\n${prompt}` : prompt;
        const ui = await a2uiGen(fullPrompt);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ success:true, ui }));
      } catch (e) { res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Handle form actions: submit data → get next A2UI
  if (url.pathname === '/a2ui/action' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { action, data, context } = JSON.parse(body);
        let nextUI;
        
        // Scene 1: Register → Welcome
        if (action === 'submit' && context.form === 'register') {
          nextUI = await a2uiGen('显示注册成功页面，欢迎用户 '+(data.name||'用户')+'，注册邮箱为 '+(data.email||''));
        }
        // Scene 2: Login → Dashboard  
        else if (action === 'submit' && context.form === 'login') {
          nextUI = await a2uiGen('登录成功后显示dashboard，包含统计卡片：用户数1234、订单567、收入89000');
        }
        // Scene 3: Leave Apply → Approval Flow
        else if (action === 'submit' && context.form === 'leave') {
          nextUI = await a2uiGen('请假申请已提交！显示审批流进度：提交申请(已完成)、部门主管审批(进行中)、HR确认(待处理)。申请人：'+(data.name||'')+'，请假'+(data.days||'')+'天');
        }
        // Scene 4: Feedback → Thanks
        else if (action === 'submit' && context.form === 'feedback') {
          nextUI = await a2uiGen('反馈提交成功！感谢您的反馈，显示一个Alert成功提示，反馈类型是'+(data.type||''));
        }
        // Generic: any submit → summary
        else {
          nextUI = await a2uiGen('显示提交成功的确认页面，已提交的数据：'+JSON.stringify(data));
        }
        
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ success:true, ui: nextUI }));
      } catch (e) { res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (url.pathname === '/a2ui/generate-renderer' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body);
        const system = 'You are a JavaScript code generator. Output ONLY the function body code for rendering an A2UI component. The function receives props object "p" and must return an HTML string. Use the rv(p.propname) helper to extract text values. Return ONLY valid JS code, no markdown, no explanation, no function wrapper.';
        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: 1000 })
        });
        const data = await resp.json();
        const code = (data.choices?.[0]?.message?.content || '').replace(/```javascript|```js|```/g, '').trim();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const content = readFileSync(join(__dirname, '..', filePath));
    const ext = filePath.split('.').pop();
    const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain', 'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *" });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});

server.listen(3456, '127.0.0.1', () => console.log('Server on http://localhost:3456'));
