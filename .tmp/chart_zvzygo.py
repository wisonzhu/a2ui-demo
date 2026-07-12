import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import json

for f in fm.fontManager.ttflist:
    if 'PingFang' in f.name:
        plt.rcParams['font.family'] = f.name
        break
plt.rcParams['axes.unicode_minus'] = False

chart = json.loads('''{"chartType":"pie","title":{"literalString":"各部门预算"},"labels":{"explicitList":["部门A","部门B","部门C","部门D"]},"datasets":{"explicitList":[{"label":{"literalString":"预算金额"},"data":{"explicitList":[300000,250000,180000,120000]},"backgroundColor":{"explicitList":["#FF6384","#36A2EB","#FFCE56","#4BC0C0"]}}]}}''')
labels = json.loads('''{"explicitList":["部门A","部门B","部门C","部门D"]}''')
datasets = json.loads('''{"explicitList":[{"label":{"literalString":"预算金额"},"data":{"explicitList":[300000,250000,180000,120000]},"backgroundColor":{"explicitList":["#FF6384","#36A2EB","#FFCE56","#4BC0C0"]}}]}''')

fig, ax = plt.subplots(figsize=(6, 4))
fig.patch.set_facecolor('#0d1117')
ax.set_facecolor('#161b22')
ax.tick_params(colors='#c9d1d9')

chartType = "pie"
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

ax.set_title(chart.get('title',{}).get('literalString',''), color='#58a6ff', fontsize=12)
plt.tight_layout()
plt.savefig("/Users/wisonzhu/projects/ag-ui-demo/.tmp/chart_zvzygo.png", dpi=100, bbox_inches='tight', facecolor='#0d1117')
