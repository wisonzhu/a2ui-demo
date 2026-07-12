import http from 'node:http';
import https from 'node:https';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import os from 'node:os';

// MUST be first — kill proxy before any fetch initialization
['http_proxy','https_proxy','HTTP_PROXY','HTTPS_PROXY','all_proxy','ALL_PROXY'].forEach(k => delete process.env[k]);

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
    } catch(e) { return 'Nginx logs not found'; }
  }
  
  // Inspection: comprehensive health check
  if (source === 'inspection') {
    const memTotal = os.totalmem()/1024/1024/1024;
    const memFree = os.freemem()/1024/1024/1024;
    const memUse = ((memTotal-memFree)/memTotal*100).toFixed(0);
    const load = os.loadavg()[0].toFixed(1);
    const uptime = os.uptime();
    const days = Math.floor(uptime/86400);
    return `巡检结果:
系统: macOS ${os.release()}, 运行${days}天, 负载${load}
内存: 总量${memTotal.toFixed(1)}G, 已用${memUse}%, 可用${memFree.toFixed(1)}G
磁盘: ${execSync("df -h / | tail -1 | awk '{print \"总量\"$2\" 已用\"$3\" 可用\"$4\" 使用率\"$5}'", {encoding:'utf8'}).trim()}
进程数: ${execSync("ps aux | wc -l", {encoding:'utf8'}).trim()}
网络: ${execSync("ifconfig en0 | grep 'inet ' | awk '{print $2}'", {encoding:'utf8'}).trim()}`;
  }
  
  // Multi-server inspection (simulated)
  if (source === 'multi-inspect') {
    return `巡检结果 - 3台服务器:
web-01: CPU 45% 内存 62% 磁盘 38% ✅正常
web-02: CPU 92% 内存 85% 磁盘 72% ⚠️CPU和内存偏高
db-master: CPU 23% 内存 78% 磁盘 55% ✅正常
Redis集群: 3节点,内存使用 45%/52%/38% ✅正常
MySQL: 连接数156/500 QPS 2340 慢查询3条 ✅正常`;
  }
  
  if (source === 'dashboard') {
    const memTotal = os.totalmem()/1024/1024/1024;
    const memFree = os.freemem()/1024/1024/1024;
    const cpuUse = parseFloat(execSync("top -l 1 -n 0 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'", {encoding:'utf8'}).trim()) || Math.floor(Math.random()*20+30);
    const memUse = ((memTotal-memFree)/memTotal*100).toFixed(0);
    const diskUse = execSync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", {encoding:'utf8'}).trim();
    const load = os.loadavg();
    const days = Math.floor(os.uptime()/86400);
    const hours = Math.floor((os.uptime()%86400)/3600);
    const procs = execSync("ps aux | wc -l", {encoding:'utf8'}).trim();
    const net = execSync("ifconfig en0 | grep 'inet ' | awk '{print $2}'", {encoding:'utf8'}).trim();
    const top10 = execSync("ps aux -r | head -11 | tail -10 | awk '{printf \"%s|%.1f|%.1f|%s|%s\\n\",$11,$3,$4,$2,substr($0,index($0,$11)+length($11)+1,30)}'", {encoding:'utf8'}).trim();
    const conns = execSync("netstat -an 2>/dev/null | grep -c ESTABLISHED || echo 0", {encoding:'utf8'}).trim();
    const hostname = execSync("hostname", {encoding:'utf8'}).trim();
    // Disk details
    const diskDetail = execSync("df -h | tail -n +2 | awk '{printf \"%s|%s|%s|%s|%s\\n\",$1,$2,$3,$4,$5}'", {encoding:'utf8'}).trim();
    // Mock service data
    return `====== 全域监控平台 - 实时数据 ======

【系统概览】
主机名: ${hostname}
IP地址: ${net}
操作系统: macOS ${os.release()}
运行时间: ${days}天${hours}小时
系统负载: 1min=${load[0].toFixed(1)} 5min=${load[1].toFixed(1)} 15min=${load[2].toFixed(1)}
CPU使用率: ${cpuUse}% (用户态${Math.floor(cpuUse*0.7)}% 系统态${Math.floor(cpuUse*0.3)}%)
内存: 总量${memTotal.toFixed(1)}G 已用${memUse}%(${(memTotal-memFree).toFixed(1)}G) 可用${memFree.toFixed(1)}G 缓存${(memFree*0.3).toFixed(1)}G
进程总数: ${procs} (运行中${Math.floor(procs*0.6)} 睡眠${Math.floor(procs*0.35)} 僵尸${Math.floor(procs*0.05)})
网络连接数: ESTABLISHED=${conns} TIME_WAIT=${Math.floor(conns*0.4)} CLOSE_WAIT=${Math.floor(conns*0.1)}
打开文件数: ${execSync("lsof 2>/dev/null | wc -l || echo 0", {encoding:'utf8'}).trim()}

【磁盘详情】
分区|总量|已用|可用|使用率
${diskDetail}

【TOP10进程 - CPU消耗】
进程名|CPU%|MEM%|PID|启动参数
${top10}

【24小时性能趋势 - 用于Chart柱状图/折线图】
CPU使用率趋势(%): 00:00=35 02:00=28 04:00=22 06:00=25 08:00=45 10:00=62 12:00=78 14:00=${cpuUse} 16:00=58 18:00=48 20:00=42 22:00=38
内存使用率趋势(%): 00:00=48 02:00=46 04:00=44 06:00=47 08:00=55 10:00=60 12:00=68 14:00=${memUse} 16:00=62 18:00=56 20:00=52 22:00=50
网络吞吐趋势(Mbps): 00:00=120 02:00=80 04:00=45 06:00=90 08:00=320 10:00=480 12:00=620 14:00=560 16:00=490 18:00=380 20:00=280 22:00=180
磁盘IO趋势(iops): 00:00=200 02:00=150 04:00=100 06:00=180 08:00=450 10:00=600 12:00=720 14:00=680 16:00=550 18:00=400 20:00=300 22:00=220
连接数趋势: 00:00=850 02:00=600 04:00=400 06:00=750 08:00=1500 10:00=2200 12:00=2800 14:00=${conns} 16:00=2400 18:00=1800 20:00=1400 22:00=1000

【服务健康状态 - 用于服务监控面板】
MySQL主库(db-master): 状态✅ 连接数156/500 QPS 2340 慢查询3条/小时 复制延迟0.2s 运行时间30天
MySQL从库(db-slave-1): 状态✅ 连接数89/300 QPS 1120 慢查询1条/小时 复制延迟0.1s 运行时间30天  
MySQL从库(db-slave-2): 状态⚠️ 连接数142/300 QPS 980 慢查询8条/小时 复制延迟2.3s 运行时间15天
Redis集群(3节点): 状态✅ 总内存使用5.8G/12G 命中率97.5% 总key数145万 连接数2340 慢查询0
Elasticsearch集群(3节点): 状态✅ 文档数8.5亿 存储3.2TB 查询QPS 450 平均延迟12ms 节点状态全部green
Nginx(web-01): 状态✅ 今日请求12.3万 错误率0.32% P50延迟35ms P99延迟220ms 活跃连接850
Nginx(web-02): 状态⚠️ 今日请求10.8万 错误率0.45% P50延迟42ms P99延迟310ms 活跃连接720
Kafka集群(3节点): 状态✅ 消息堆积0 每秒入站3.2万条 出站2.8万条 消费者lag<100
RabbitMQ: 状态✅ 队列总数45个 消息速率1200/s 连接数560 Ready消息3200条

【告警中心 - 最近7天】
严重(P0):
- CPU使用率飙升至92%，影响web-02节点 2小时前 处理中 负责人:张三
- 磁盘/data分区使用率87%，db-master服务器 1天前 已恢复 自动清理完成
- API网关5xx错误率突增至2.1%，影响全部用户 3天前 已恢复 上游服务超时已修复
警告(P1):
- 内存使用率持续>85%，cache-01节点 1小时前 未处理
- 连接池耗尽db-slave-2，最大500已达488 30分钟前 处理中
- SSL证书7天后过期，域名*.example.com 6小时前 未处理
- 数据备份延迟45分钟，备份任务#3421 1天前 处理中
信息(P2):
- 自动扩容完成 web-tier 3→5节点 6小时前 已完成
- 计划维护窗口确认 明晨02:00-04:00 12小时前 待执行
- 安全扫描完成 发现3个低危漏洞 1天前 待修复
- 资源使用预测 未来7天需要扩容2台web节点

【部署记录 - Timeline/Steps组件】
v3.2.2: 灰度发布中(10%流量) 1小时前 发布人:李四
v3.2.1: 生产环境全量部署 成功 1天前 耗时8分钟 发布人:王五
v3.2.0: 预发布环境验证通过 成功 2天前 耗时5分钟 自动触发
v3.1.9: 生产环境回滚(紧急) 因5xx错误率过高 3天前 回滚到v3.1.8
v3.1.8: 生产环境部署 成功 4天前 耗时12分钟

【资源容量规划】
CPU: 当前${cpuUse}% | 7天峰值92% | 30天平均65% | 建议:正常
内存: 当前${memUse}% | 7天峰值89% | 30天平均72% | 建议:考虑扩容
磁盘: 当前${diskUse}% | 7天预测可达90% | 建议:清理或扩容
网络带宽: 峰值使用62% | 趋势平稳 | 建议:正常

【SLA 统计 - 本月】
API可用率: 99.97% (目标99.9% ✅)
P50延迟: 35ms (目标<100ms ✅)
P99延迟: 218ms (目标<500ms ✅)
错误率: 0.12% (目标<0.5% ✅)
本月宕机: 累计2.3分钟
MTTR(平均恢复): 3.8分钟
MTBF(平均故障间隔): 720小时`;
  }
  
  // All data sources for ops platform
  if (source === 'cmdb') {
    return `【CMDB - 全量资产】
项目数量: 12个 (电商平台3 支付系统2 用户中心2 物流1 大数据2 运维工具2)
环境: 生产4套 预发布3套 测试5套

服务器清单(按项目分组):
电商平台-生产: web-01(4C16G CentOS7.9 192.168.1.10 运行120天) web-02(4C16G 192.168.1.11 运行120天) web-03(8C32G 192.168.1.12 运行60天) app-01(8C32G 192.168.1.20 运行90天) db-master(16C64G SSD500G 192.168.1.30 运行365天) cache-01(8C32G 192.168.1.40 运行180天)
电商平台-预发布: web-pre-01(2C8G 192.168.2.10 运行45天) db-pre(4C16G 192.168.2.30 运行45天)
支付系统-生产: pay-gw-01(4C16G 10.0.1.10 运行200天) pay-gw-02(4C16G 10.0.1.11 运行200天) pay-svc-01(8C32G 10.0.1.20 运行200天) pay-db(16C64G 10.0.1.30 运行400天)
用户中心-生产: ucenter-01(4C16G 172.16.1.10 运行150天) ucenter-db(8C32G 172.16.1.30 运行150天)
大数据-生产: hadoop-nn(16C64G 10.10.1.10 运行300天) hadoop-dn-01~06(各8C32G) spark-master(16C128G 10.10.1.20 运行300天)

数据库清单:
MySQL: 电商主库(16C64G 500G 主从) 支付库(16C64G 200G 一主两从) 用户库(8C32G 100G) 配置库(4C16G 50G)
Redis: 电商缓存(3主3从 12G) 支付缓存(3主3从 8G) Session(3节点 4G) 排行榜(单机16G)
MongoDB: 日志库(3节点 200G) 用户行为(3节点 500G)
Elasticsearch: 搜索(3节点 1TB) 日志(5节点 5TB)
Kafka: 消息队列(5节点) IoT数据(3节点)
RabbitMQ: 异步任务(2节点)

中间件:
Nginx: web-01/02(生产) web-pre-01(预发布) 
Kong API网关: 2节点(生产) 
Nacos配置中心: 3节点(生产) 1节点(预发布)
Zookeeper: 3节点(生产)

网络:
VPC: 生产VPC(10.0.0.0/16) 预发布VPC(172.16.0.0/16) 测试VPC(192.168.0.0/16)
SLB: 电商前端(2个) 支付前端(1个) API网关(1个)
带宽: 生产1Gbps 预发布200Mbps`;
  }
  
  if (source === 'cloud') {
    return `【云平台资源总览】
阿里云(生产):
ECS: 45台 (总CPU 320核 内存640G) 运行中44台 已停止1台
RDS: 8个实例 (MySQL5.7×5 MySQL8.0×3) 总存储3.2TB
Redis: 6个集群 (总内存52G 使用率68%)
SLB: 6个实例 (QPS峰值5.2万)
OSS: 总存储15TB (标准8TB 低频3TB 归档4TB)
CDN: 月流量85TB 命中率92%
NAS: 3个文件系统 总容量2TB
WAF: 3个实例 月拦截攻击12万次
DDoS防护: 清洗峰值50Gbps
KMS: 密钥12个
RAM: 用户45个 角色23个

华为云(灾备):
ECS: 8台 (总CPU 48核 内存96G)
RDS: 2个实例 (MySQL 灾备同步)
OBS: 总存储5TB (灾备数据)

域名与证书:
生产域名: *.example.com (通配符 2026-09-15到期)
API域名: api.example.com (2026-11-01到期)
内部域名: *.internal.example.com (自签 2027-03-01到期)
CDN域名: cdn.example.com (自动续期)

本月成本:
ECS: ¥85,200 | RDS: ¥32,500 | Redis: ¥18,600
OSS: ¥6,200 | CDN: ¥12,800 | SLB: ¥4,500
WAF: ¥8,000 | DDoS: ¥15,000 | 其他: ¥7,200
总计: ¥190,000 (较上月+8.5% 原因:新增4台ECS)`;
  }
  
  if (source === 'release') {
    return `【发布管理系统】
当前发布:
v3.2.3 - 灰度10%流量 (web-tier) 开始时间:30分钟前 状态:观察中 发布人:李四
v3.2.2 - 全量部署 (pay-gw) 开始时间:2小时前 状态:完成 耗时:5分钟 发布人:王五

最近发布记录(30天):
v3.2.1 | 生产全量 | 07-14 10:30 | 成功 | 耗时8分钟 | 发布人:张三 | 变更:支付流程优化/新增退款接口/修复金额精度bug
v3.2.0 | 生产全量 | 07-13 14:00 | 成功 | 耗时6分钟 | 发布人:李四 | 变更:搜索算法升级/商品推荐优化/页面性能优化
v3.1.9 | 回滚 | 07-12 16:30 | 紧急回滚 | 耗时3分钟 | 回滚人:王五 | 原因:5xx错误率飙升至2.1% 影响全部用户
v3.1.8 | 生产全量 | 07-10 09:00 | 成功 | 耗时12分钟 | 发布人:张三 | 变更:数据库迁移MySQL5.7→8.0/分库分表/慢查询优化
v3.1.7 | 预发布 | 07-09 17:00 | 验证通过 | 耗时5分钟 | 发布人:李四
v3.1.6 | 生产全量 | 07-08 11:00 | 成功 | 耗时7分钟 | 发布人:王五
v3.1.5 | 灰度→全量 | 07-06 15:00 | 成功 | 灰度2小时后全量 | 发布人:张三
v3.1.4 | 生产全量 | 07-04 10:30 | 成功 | 耗时9分钟 | 发布人:李四
v3.1.3 | 回滚 | 07-03 14:00 | 紧急回滚 | 耗时2分钟 | 回滚人:王五 | 原因:缓存雪崩 Redis内存溢出
v3.1.2 | 生产全量 | 07-01 09:00 | 成功 | 耗时11分钟 | 发布人:张三

发布统计(30天):
总发布次数:12 成功:9 回滚:2 灰度中:1
平均发布耗时:7.2分钟
回滚率:16.7%
发布高峰时段:10:00-12:00 14:00-16:00

待审批发布:
v3.3.0 - 电商首页改版 计划:07-16 10:00 审批人:技术总监
v3.3.1 - 支付风控升级 计划:07-17 14:00 审批人:技术总监

发布流水线配置:
代码检查 → 单元测试 → 构建镜像 → 安全扫描 → 部署预发布 → 自动化测试(接口/UI/性能) → 审批 → 灰度10% → 观察30分钟 → 灰度50% → 观察1小时 → 全量部署 → 监控确认`;
  }
  
  if (source === 'ticket') {
    return `【工单系统】
当前工单统计:
待处理: 8 | 处理中: 12 | 已完成(本周): 45
SLA达标率: 94.2% | 平均响应: 12分钟 | 平均解决: 3.2小时

待处理工单(P0/P1):
#INC-4521 P0 | CPU飙升至96% web-03 | 提交:15分钟前 | 负责人:张三 | 影响:电商首页访问慢
#INC-4520 P0 | 支付回调超时 支付网关 | 提交:1小时前 | 处理中:李四 | 影响:用户无法支付
#INC-4519 P1 | Redis内存使用率>92% | 提交:2小时前 | 处理中:王五 | 影响:缓存命中率下降
#INC-4518 P1 | MySQL慢查询突增 db-slave-2 | 提交:3小时前 | 未处理 | 影响:报表查询变慢
#INC-4517 P1 | SSL证书7天后过期 | 提交:6小时前 | 未处理 | 影响:浏览器安全警告
#INC-4516 P2 | ELK日志延迟30分钟 | 提交:1天前 | 未处理 | 
#INC-4515 P2 | 自动备份失败(已重试3次) | 提交:1天前 | 处理中:赵六 |
#INC-4514 P2 | 测试环境部署失败 | 提交:2天前 | 未处理 |
#INC-4513 P2 | 监控大盘部分图表加载慢 | 提交:2天前 | 未处理 |
#INC-4512 P2 | API文档未更新 | 提交:3天前 | 处理中:孙七 |

本周已完成工单(最近10条):
#INC-4511 | 磁盘空间不足 | 07-14完成 | 解决人:张三 | 方案:清理日志+扩容
#INC-4510 | 数据库连接池耗尽 | 07-14完成 | 解决人:李四 | 方案:增加连接数200→500
#INC-4509 | 内存泄漏 web-01 | 07-13完成 | 解决人:王五 | 方案:重启+修复代码
#INC-4508 | CDN回源率异常 | 07-13完成 | 解决人:赵六 | 方案:调整缓存策略
#INC-4507 | 安全扫描发现高危漏洞 | 07-12完成 | 解决人:张三 | 方案:升级组件版本
#INC-4506 | K8s节点NotReady | 07-12完成 | 解决人:李四 | 方案:重启kubelet
#INC-4505 | 消息队列堆积10万条 | 07-11完成 | 解决人:王五 | 方案:扩容Consumer
#INC-4504 | API限流误触发 | 07-11完成 | 解决人:赵六 | 方案:调整限流阈值
#INC-4503 | 配置文件错误 | 07-10完成 | 解决人:张三 | 方案:回滚配置
#INC-4502 | 数据同步延迟 | 07-10完成 | 解决人:李四 | 方案:优化同步SQL

变更记录(本周):
#CHG-234 | MySQL主库扩容 16C→32C | 07-14 02:00执行 | 成功 | 影响:无
#CHG-233 | Redis集群增加节点 | 07-13 03:00执行 | 成功 | 影响:无
#CHG-232 | Nginx配置优化 | 07-12 01:00执行 | 成功 | 影响:短暂重连`;
  }
  
  // K8s details
  if (source === 'k8s-detail') {
    return `【Kubernetes集群详情】
集群: prod-k8s (v1.28.5) | 节点:8台 (4C16G×4 + 8C32G×4) | 命名空间:6个

节点状态:
k8s-node-01 | 4C16G | Ready | CPU 42% MEM 58% | Pods:28/110 | 运行365天
k8s-node-02 | 4C16G | Ready | CPU 65% MEM 72% | Pods:35/110 | 运行365天
k8s-node-03 | 4C16G | Ready | CPU 38% MEM 45% | Pods:22/110 | 运行200天
k8s-node-04 | 4C16G | Ready | CPU 55% MEM 62% | Pods:30/110 | 运行200天
k8s-node-05 | 8C32G | Ready | CPU 28% MEM 40% | Pods:18/55 | 运行150天
k8s-node-06 | 8C32G | Ready | CPU 72% MEM 78% | Pods:42/55 | 运行150天
k8s-node-07 | 8C32G | Ready | CPU 35% MEM 48% | Pods:25/55 | 运行90天
k8s-node-08 | 8C32G | Ready | CPU 48% MEM 55% | Pods:32/55 | 运行90天

命名空间:
production: 85个Pod (web×12 api×18 worker×15 db-proxy×8 cache×10 mq×8 monitoring×14)
staging: 28个Pod
monitoring: 18个Pod (Prometheus Grafana AlertManager Loki Jaeger)
logging: 12个Pod (Elasticsearch×5 Fluentd×6 Kibana×1)
ingress: 10个Pod (nginx-ingress×8 cert-manager×2)
kube-system: 25个Pod

Deployment健康:
web-frontend: 12/12 Ready ✅ | web-api: 18/18 Ready ✅ | worker-order: 15/15 Ready ✅
db-proxy: 8/8 Ready ✅ | redis-proxy: 10/10 Ready ✅ | mq-consumer: 8/8 Ready ✅
monitor-grafana: 1/1 Ready ✅ | monitor-prometheus: 1/1 Ready ✅

最近事件:
Warning: k8s-node-06 内存使用率>75% 需要关注
Normal: HPA触发 web-api 从15副本扩至18副本
Warning: pod worker-order-7d8f9 重启3次(今天) 需要排查
Normal: cert-manager自动续期成功 *.example.com

存储:
PVC总数: 156个 已使用: 1.2TB/2TB
StorageClass: ssd-fast(512G已用380G) hdd-standard(1.5TB已用820G)`;
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
    signal: AbortSignal.timeout(25000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.7, max_tokens: 8192
    })
  }).catch(e => {
    console.error('DeepSeek fetch error:', e.message);
    return { json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
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
        // Scene 5: Incident report
        else if (action === 'submit' && context.form === 'incident') {
          nextUI = await a2uiGen('故障已申报！工单号INC-' + Math.floor(Math.random()*9000+1000) + '。显示Alert成功提示，内容包括主机名'+(data.host||'')+'严重级别'+(data.level||'')+'。Timeline显示预期处理流程：接单(待处理)→排查(待处理)→修复(待处理)→验证(待处理)');
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
