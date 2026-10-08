export const socialLoginSchema = `enum LoginAction { BEGIN COMPLETE }
type ProductIdentity { provider: String! subject: String! username: String! name: String avatarUrl: String }
type LoginResult { authorizationUrl: String state: String proof: String expiresAt: String identity: ProductIdentity }
type Query { info: String! }
type Mutation { login(action: LoginAction!, code: String, state: String, proof: String): LoginResult! }`
