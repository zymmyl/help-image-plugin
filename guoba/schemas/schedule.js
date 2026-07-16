export default [
  {
    component: "Divider",
    label: "合并转发设置"
  },
  {
    field: "customText",
    label: "合并转发底部自定义文本",
    component: "Input",
    placeholder: "输入要追加到合并转发底部的文本",
    defaultValue: ""
  },
  {
    component: "Divider",
    label: "定时推送设置"
  },
  {
    field: "scheduledPush.enabled",
    label: "启用定时推送",
    component: "Switch",
    defaultValue: false
  },
  {
    field: "scheduledPush.cron",
    label: "推送时间 (Cron表达式)",
    component: "Input",
    placeholder: "例如: 0 9 * * * (每天9点)",
    defaultValue: "0 9 * * *"
  }
]
