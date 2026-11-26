# 部署 PPTGod

PPTGod 使用 PostgreSQL 保存账号、风格和文稿，Better Auth 管理登录，Resend 投递验证邮件和密码重置邮件。Upstash 在服务实例之间共享使用额度，Cloudflare R2 缓存已保存文稿的 PowerPoint 导出。Mastra 可连接 OpenAI 兼容模型，访客也可以使用内置构稿功能。

## 建立生产数据库

在独立的 PostgreSQL 项目中复制启用 TLS 的连接字符串。使用 Neon 时，可把连接池地址填入 `DATABASE_URL`，并把直连地址填入本地 `DATABASE_MIGRATION_URL`。使用 Supabase 时，在项目的 **Connect** 页面获取地址。对仅支持 IPv4 的托管环境，可使用 Session pooler 的 5432 端口。

在 Node.js 22 环境运行以下命令。数据库和应用位于专用的 `pptgod` schema，把它留在 Supabase Data API 的暴露列表之外。

```bash
npm ci
npm run db:migrate
npm run db:seed
```

已有 SQLite 数据时，先备份，再在空的新数据库上运行迁移。接着导入备份并补齐官方风格。老用户保留原邮箱、密码和文稿，需要重新登录。

```bash
npm run db:migrate
npm run db:import-sqlite -- /path/to/pptgod.db
npm run db:seed
```

[Neon 连接指南](https://neon.com/docs/connect/connect-from-any-app) · [Supabase 连接指南](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 配置存储、Redis 和邮件

| 平台 | 设置 | 填入 Render 环境变量 |
| --- | --- | --- |
| Cloudflare R2 | 创建专用私有 Standard 存储桶，创建只允许读写该桶的 S3 凭据，为 `pptx-cache/` 前缀配置 7 天自动删除规则 | `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` |
| Upstash | 建立专用的 Redis 数据库，选择靠近应用的区域 | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` |
| Resend | 验证一个发信子域，例如 `notify.example.com`，创建限定发信权限的凭据 | `RESEND_API_KEY`、`RESEND_FROM_EMAIL` |

原始文档上传后用于当次解析。已保存文稿的导出缓存只有文稿所有者可以通过应用读取。不要启用 R2 的公开访问。生产凭据通过托管平台的环境变量保存。

[R2 使用额度](https://developers.cloudflare.com/r2/pricing/) · [Upstash Redis 额度](https://upstash.com/pricing/redis) · [Resend 域名验证](https://resend.com/docs/dashboard/domains/introduction)

## 上线与绑定域名

1. 从包含 `render.yaml` 的分支创建 Render Blueprint，区域为新加坡。免费实例空闲后会休眠，首次重新访问可能需要等待。
2. 填入生产数据库、R2、Upstash、Resend 的配置。Render 会生成 `BETTER_AUTH_SECRET`。初次可用 Render 提供的 HTTPS 地址作为 `BETTER_AUTH_URL`，填入完整站点地址。
3. 在 Render 的 **Custom Domains** 添加你已持有的域名。根据 Render 提供的值配置 DNS。用 Cloudflare 时，先设为 **DNS only**，确认域名验证与 HTTPS 正常后，再决定是否启用代理。如果域名注册在阿里云，也可在现有 DNS 控制台添加相同记录。
4. 把 `BETTER_AUTH_URL` 更新为正式 HTTPS 网址并重新部署，确认邮件里的登录回跳链接使用正式域名。

可选的站点级 AI 配置使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_MODEL`。生图可单独设置 `OPENAI_IMAGE_API_KEY`、`OPENAI_IMAGE_MODEL`。如果不配置站点模型，访客仍可使用内置构稿与导出，也可以在编辑器中提供自己的模型凭据。

在正式站点打开 `/api/health`，确认返回 `ok`、`postgresql` 和至少 36 个风格。用测试账号完成邮箱验证、登录、生成、保存、下载和重置密码。用无痕窗口确认私人文稿和已保存文稿的专属下载均无法访问。

[Render 免费实例](https://render.com/docs/free) · [Render 与 Cloudflare 自定义域名](https://render.com/docs/configure-cloudflare-dns) · [Cloudflare DNS 代理设置](https://developers.cloudflare.com/dns/manage-dns-records/reference/proxied-dns-records/)
