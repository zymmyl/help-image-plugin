export default [
  {
    component: "Divider",
    label: "机器人发送名单"
  },
  {
    field: "botList",
    label: "允许发送的机器人QQ列表",
    component: "Input",
    placeholder: "多个QQ号用英文逗号分隔",
    defaultValue: ""
  },
  {
    component: "Divider",
    label: "群聊黑白名单"
  },
  {
    field: "groupWhitelist",
    label: "群聊白名单",
    component: "Input",
    placeholder: "多个群号用英文逗号分隔，留空则不限制",
    defaultValue: ""
  },
  {
    field: "groupBlacklist",
    label: "群聊黑名单",
    component: "Input",
    placeholder: "多个群号用英文逗号分隔，优先级高于白名单",
    defaultValue: ""
  }
]
