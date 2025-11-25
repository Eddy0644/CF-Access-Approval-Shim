# Cloudflare Access 配置指南

## 1. 部署 IdP 服务

### 环境变量配置

创建 `.env` 文件：

```bash
# 服务器配置
PORT=47700
ISSUER_URL=https://your-idp-domain.com

# OIDC 客户端配置
CLIENT_ID=cloudflare-access
CLIENT_SECRET=your-secure-secret
REDIRECT_URI=https://your-team.cloudflareaccess.com/cdn-cgi/access/callback

# 邮箱格式
EMAIL_DOMAIN=access-granted.com
EMAIL_FORMAT=YYYYMMDDHHmmss

# Bark 通知
BARK_URL_TEMPLATE=https://api.day.app/YOUR_KEY/AuthRequest/{body}?url={url}

# 管理员
ADMIN_USER=admin
ADMIN_PASS=your-password
ADMIN_SESSION_HOURS=2160

# JWT 密钥 (必填，用于会话持久化)
JWT_SECRET=your-random-secret
```

### 启动服务

```bash
npm install
npm start
```

### 通过 Cloudflared 暴露

```bash
cloudflared tunnel --url http://localhost:47700
```

## 2. 获取 OIDC 端点

访问: `https://your-idp-domain.com/.well-known/openid-configuration`

记录以下端点：
- `authorization_endpoint` → Auth URL
- `token_endpoint` → Token URL
- `jwks_uri` → Certificate URL

## 3. 配置 Cloudflare Access

1. 登录 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. 进入 **Settings** → **Authentication** → **Login methods**
3. 点击 **Add new** → 选择 **OpenID Connect**
4. 填写配置：

| 字段 | 值 |
|------|-----|
| Name | Custom Approval IdP |
| App ID | `cloudflare-access` |
| Client Secret | 你的 `CLIENT_SECRET` |
| Auth URL | `https://your-idp/auth` |
| Token URL | `https://your-idp/token` |
| Certificate URL | `https://your-idp/jwks` |
| PKCE | 禁用 |
| Email claim | `email` |
| Scopes | `openid email profile` |

5. 保存

## 4. 创建 Access 应用

1. 进入 **Access** → **Applications**
2. 创建 **Self-hosted** 应用
3. 配置域名和策略
4. 选择你的自定义 IdP 作为认证方式

## 使用流程

```
访客访问受保护资源
        ↓
    提交申请理由
        ↓
   管理员收到 Bark 通知
        ↓
    管理员审批/拒绝
        ↓
   访客刷新页面完成登录
```

## 故障排查

**oidc_fields 为空**: 确保 Cloudflare 配置中 Scopes 包含 `openid email profile`

**redirect_uri 错误**: 检查 `.env` 中的 `REDIRECT_URI` 是否与 Cloudflare team name 匹配

**会话丢失**: 确保设置了 `JWT_SECRET` 环境变量
