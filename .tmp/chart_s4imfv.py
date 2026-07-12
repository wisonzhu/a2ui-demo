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

labels = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"]
datasets = [{"label":"访问量（万次）","data":[12,15,18,22,28,35,42,48,45,38,30,25]}]
chartType = "line"

fig, ax = plt.subplots(figsize=(6, 4))
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

ax.set_title("2024年月度访问量", color='#58a6ff', fontsize=12)
plt.tight_layout()
plt.savefig("/Users/wisonzhu/projects/ag-ui-demo/.tmp/chart_s4imfv.png", dpi=100, bbox_inches='tight', facecolor='#0d1117')
