# 桌面 Connection 兼容补丁：使用与安全

这是针对 **DeepSeek Harness Desktop 0.2.2-rc.5** 的独立、仅配置型兼容 bundle，解决该版本 Connection 服务在注册独立 RPC 路由时未声明 `webServer` 依赖的问题。它不是本地记忆插件本身，不会随本地记忆插件自动安装或启用，也不应安装到 Web、SDK 或其他 profile。

## 使用前核对

1. 确认正在管理的是 Desktop profile，运行时版本**精确为 0.2.2-rc.5**；其他版本即使允许安装也不得直接套用，应先重新检查其 Connection 源码与配置。不要用版本豁免绕过检查。
2. 确认目标 `connection` 行名称是 `@deepseek-ai/dsh-client-connection`、其原有行级 `inject` 为 `[webStartup]`，且没有其他自定义层改写该行依赖。此补丁将其改为 `[webStartup, webServer]`；它替换的是整个行级注入列表，不是自动合并。如果还有其他已有依赖、覆盖或特殊启动顺序，**不要直接安装或启用**，需先由熟悉当前组合的人单独审查并保留全部依赖。
3. 检查 profile 和全局覆盖层中已有的 `connection` 配置。此补丁不声明 `config`，意在保留用户的 `trustedHosts` 等配置；但更高优先级的覆盖、不同 bundle 顺序或自定义配置可能改变最终结果，安装前后都应核对。不要覆盖用户配置或凭据。
4. 先结束桌面版中的活动会话、插件任务和上传，并备份相关 profile 配置。启用、停用或重启可能重新加载 Connection，导致桌面界面断线、当前请求中断；不要在任务运行时操作。更换已加载的模块也可能需要完全退出并重开 Desktop。

## 安装、验证和停用

在确认上述条件后，只通过 **Desktop 的插件管理器**安装本子目录并启用；不要在 Web 的插件管理器或普通 Web CLI profile 上执行。确认新 bundle 实际排在提供 `connection` 行的基础/web-app bundle 之后，且后续 bundle、profile 和全局覆盖没有覆盖该注入列表。安装后查看插件状态，确认本地记忆不再报 `webServer without inject`，并确认桌面 API 能正常认证；不以安装成功代替运行验证。

若不再需要补丁，先结束活动任务，再在 **Desktop 的插件管理器**中停用该兼容 bundle，并按应用提示完全退出、重开；停用可能中断连接。停用后的实际注入由其他已启用 bundle 和用户覆盖共同决定，不能假设一定恢复为原始列表。切勿为了停用该补丁而删除本地记忆数据库、工作区、Web 数据或凭据。

本补丁只针对上述已验证组合。它的存在不证明其他 DSH 版本、其他平台或自定义 Connection 覆盖兼容；Desktop 更新后应先停用并审查，而非永久依赖或无条件迁移该补丁。局部文件路径、插件 API 和设置均可能随版本变化。
