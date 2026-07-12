
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json, base64, os

chart = json.loads('''{"chartType":"pie","title":{"literalString":"预算分布"},"labels":["研发","市场","行政","其他"],"datasets":[{"label":"预算","data":[40,30,20,10]}],"sizes":{"width":600,"height":400}}''')

fig, ax = plt.subplots(figsize=(600/100, 400/100))
fig.patch.set_facecolor('#0d1117')
ax.set_facecolor('#161b22')
ax.tick_params(colors='#c9d1d9')
ax.xaxis.label.set_color('#c9d1d9')
ax.yaxis.label.set_color('#c9d1d9')
ax.title.set_color('#58a6ff')
for spine in ax.spines.values(): spine.set_color('#30363d')

labels = ["研发","市场","行政","其他"]
datasets = [{"label":"预算","data":[40,30,20,10]}]
chartType = "pie"

if chartType == 'pie':
    wedges, texts, autotexts = ax.pie(datasets[0]['data'], labels=labels, autopct='%1.1f%%',
        colors=['#238636','#1f6feb','#d29922','#f85149','#a371f7','#3fb950'],
        textprops={'color':'#c9d1d9'})
else:
    for ds in datasets:
        color = ds.get('color', None)
        if chartType == 'bar':
            ax.bar(labels, ds['data'], label=ds['label'])
        elif chartType == 'line':
            ax.plot(labels, ds['data'], marker='o', label=ds['label'])
    ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#c9d1d9')

ax.set_title(chart.get('title',{}).get('literalString',''), color='#58a6ff', fontsize=12)
plt.tight_layout()
plt.savefig("/Users/wisonzhu/projects/ag-ui-demo/.tmp/chart_g1rkky.png", dpi=100, bbox_inches='tight', facecolor='#0d1117')
