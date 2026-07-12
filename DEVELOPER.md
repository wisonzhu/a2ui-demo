# A2UI 业务系统接入指南

## 接入方式（3 种）

### 方式 1：数据源接入（最简单）
在 server.js 的 `fetchRealData()` 加一个分支，从你的系统取数据：

```javascript
// server/server.js → fetchRealData()
if (source === 'my-system') {
  const db = await connectToMySQL()
  const users = await db.query('SELECT count(*) FROM users')
  const orders = await db.query('SELECT count(*) FROM orders WHERE date=today()')
  const revenue = await db.query('SELECT sum(amount) FROM orders WHERE date=today()')
  return `用户数:${users} 今日订单:${orders} 收入:${revenue}元`
}
```

前端调用：
```html
<button data-demo="显示今日业务数据" data-source="my-system">📊 业务大盘</button>
```

### 方式 2：Action 接入（表单提交等）
在 `/a2ui/action` 端点处理业务逻辑：

```javascript
// 请假审批
if (action === 'submit' && context.form === 'leave') {
  await db.insert('leave_requests', data)  // 保存到数据库
  await notify('dingtalk', {user: data.name, days: data.days})  // 通知
  nextUI = await a2uiGen('审批已提交，等待主管审批。显示审批进度Steps')
}

// 故障处理
if (action === 'submit' && context.form === 'incident') {
  await createJiraTicket(data)  // 创建工单
  await pagerDuty.alert(data.severity)  // 发送告警
  nextUI = await a2uiGen('工单已创建：#INC-'+ticketId+'，值班人员已通知')
}
```

### 方式 3：Cron 巡检（定时任务）
用 Hermes cron 定时巡检并推送结果：

```bash
# 添加到 cronjob
hermes cron create \
  --name "每小时巡检" \
  --schedule "0 * * * *" \
  --prompt "执行服务器巡检，检查CPU/内存/磁盘/服务状态，异常用钉钉通知" \
  --deliver "dingtalk"
```

## 常用接入场景

| 场景 | 数据源 | 实现 |
|------|--------|------|
| MySQL/PostgreSQL | 数据库查询 | `fetchRealData()` 分支 |
| K8s 集群 | kubectl / K8s API | `execSync("kubectl ...")` |
| 云资源(AWS/Ali) | SDK/CLI | `import {ECS} from '@aws-sdk'` |
| Prometheus | HTTP API | `fetch('http://prom:9090/query?...')` |
| ELK/日志 | ES Query | `fetch('http://es:9200/_search...')` |
| Jira/工单 | REST API | `fetch('https://jira.com/rest/api/...')` |
| 钉钉/企微通知 | Webhook | `fetch('https://oapi.dingtalk.com/...')` |
| 自定义 API | 任何 REST/GraphQL | `fetch()` 调用 |

## 完整示例：接入真实 MySQL

```javascript
// 1. 安装依赖
// npm install mysql2

// 2. server.js 顶部
import mysql from 'mysql2/promise'
const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: 'xxx',
  database: 'ops', waitForConnections: true
})

// 3. fetchRealData 分支
if (source === 'mysql-status') {
  const [rows] = await pool.query('SHOW STATUS')
  const conns = rows.find(r => r.Variable_name === 'Threads_connected')
  const qps = rows.find(r => r.Variable_name === 'Queries')
  const slow = rows.find(r => r.Variable_name === 'Slow_queries')
  return `MySQL状态: 连接数${conns.Value} QPS趋势上升 慢查询${slow.Value}条`
}
```

## 架构总结

```
你的业务系统(DB/API/K8s/云) 
    ↓ fetchRealData() 拉取数据
A2UI 后端(port 3456)
    ↓ DeepSeek 生成 A2UI JSON
A2UI 前端(port 3333)
    ↓ 37组件渲染
运维人员看到的交互式界面
```
