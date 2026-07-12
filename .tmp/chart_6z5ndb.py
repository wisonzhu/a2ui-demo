
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json, base64, os

chart = json.loads('''{"chartType":"bar","title":{"literalString":"各季度销售额"},"labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"销售额","data":[120,200,150,180]}],"sizes":{"width":400,"height":300}}''')

fig, ax = plt.subplots(figsize=(400/100, 300/100))
fig.patch.set_facecolor('#0d1117')
ax.set_facecolor('#161b22')
ax.tick_params(colors='#c9d1d9')
ax.xaxis.label.set_color('#c9d1d9')
ax.yaxis.label.set_color('#c9d1d9')
ax.title.set_color('#58a6ff')
for spine in ax.spines.values(): spine.set_color('#30363d')

labels = ["Q1","Q2","Q3","Q4"]
datasets = [{"label":"销售额","data":[120,200,150,180]}]
chartType = "bar"

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
plt.savefig("/Users/wisonzhu/projects/ag-ui-demo/.tmp/chart_6z5ndb.png", dpi=100, bbox_inches='tight', facecolor='#0d1117')
