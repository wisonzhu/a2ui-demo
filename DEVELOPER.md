# A2UI 业务开发对接指南

## 架构

```
用户输入 → 后端(3456) → DeepSeek → A2UI JSON → 前端渲染
                ↑
            业务数据源
         (数据库/API/K8s/系统命令)
```

## 快速接入 3 步

### 1. 接入真实数据源

在 `server/server.js` 的 `fetchRealData()` 添加你的数据源：

```javascript
if (source === 'myapp') {
  // 从你的业务系统获取数据
  const orders = await db.query('SELECT count(*) FROM orders WHERE date=today()')
  const revenue = await api.get('https://your-api.com/revenue')
  return `订单: ${orders}, 收入: ${revenue}`
}
```

前端调用时传 `dataSource` 参数：
```javascript
fetch('/a2ui/generate', {
  body: JSON.stringify({
    prompt: '显示今日订单统计',
    dataSource: 'myapp'  // ← 指定数据源
  })
})
```

### 2. 处理业务动作（表单提交等）

在 `server/server.js` 的 `/a2ui/action` 端点添加业务处理：

```javascript
if (action === 'submit' && context.form === 'myForm') {
  // 保存到数据库
  await db.insert('users', data)
  // 返回下一页 UI
  nextUI = await a2uiGen('显示提交成功页面')
}
```

### 3. 添加场景按钮

在 `app.html` 添加场景按钮：

```html
<button data-demo="你的提示词" data-source="myapp">🔧 我的场景</button>
```

前端会自动在 prompt 中加入 `dataSource` 参数。

## 数据源类型

| 类型 | 数据源 | 说明 |
|------|--------|------|
| system | 本机系统 | CPU/内存/磁盘/运行时间 |
| k8s | Kubernetes | Pod数/节点数/资源使用 |
| docker | Docker | 容器列表/状态 |
| nginx | Nginx | 访问日志统计 |
| git | Git仓库 | 最近提交记录 |
| 自定义 | 你的API/DB | 任何业务数据 |

## 故障处理场景示例

```
// 场景: K8s Pod 故障
dataSource: 'k8s'
prompt: '显示有问题的Pod列表，用Table展示，失败的Pod用Alert标注'

// 场景: 磁盘告警
dataSource: 'system'
prompt: '磁盘使用率超过80%的告警面板，显示具体数值'

// 场景: Nginx 错误率
dataSource: 'nginx'
prompt: '显示Nginx错误率趋势和最近5xx错误统计'
```

## API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| /a2ui/generate | POST | 生成 UI |
| /a2ui/action | POST | 处理业务动作 |
| /a2ui/key | GET | 获取默认 API Key |
| /agui/stream | POST | AG-UI 流式对话 |

## 完整示例

```bash
# 1. 生成带真实数据的 K8s 监控面板
curl -X POST http://localhost:3456/a2ui/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"K8s集群监控","dataSource":"k8s"}'

# 2. 处理请假审批
curl -X POST http://localhost:3456/a2ui/action \
  -H 'Content-Type: application/json' \
  -d '{"action":"submit","context":{"form":"leave"},"data":{"name":"张三","days":"3"}}'

# 3. 保存到你的业务系统
# 在 /a2ui/action 的 if(context.form==='xxx') 分支里:
#   await yourDB.leaveRequests.insert(data)
#   nextUI = await a2uiGen('审批已提交')
```
