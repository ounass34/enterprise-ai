from dataclasses import dataclass
from fastapi import Header, HTTPException
from .config import get_settings
import jwt
from jwt import PyJWKClient

@dataclass
class CurrentUser:
    external_id: str
    name: str
    email: str
    role: str = "employee"
    department: str | None = None

_jwk_clients: dict[str, PyJWKClient] = {}

def _oidc_user(token: str) -> CurrentUser:
    s=get_settings()
    issuer=s.oidc_issuer
    jwks_url=issuer.rstrip('/')+'/.well-known/openid-configuration'
    # Keycloak exposes JWKS through the realm endpoint; PyJWKClient can consume it directly.
    jwks_uri=issuer.rstrip('/')+'/protocol/openid-connect/certs'
    client=_jwk_clients.setdefault(jwks_uri, PyJWKClient(jwks_uri, cache_jwk_set=True, lifespan=300))
    try:
        signing_key=client.get_signing_key_from_jwt(token)
        claims=jwt.decode(token, signing_key.key, algorithms=['RS256'], issuer=issuer, options={'verify_aud':False})
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f'Invalid identity token: {exc}')
    roles=(claims.get('realm_access') or {}).get('roles') or []
    role=next((r for r in ('admin','manager','employee') if r in roles),'employee')
    return CurrentUser(str(claims.get('sub')), claims.get('name') or claims.get('preferred_username') or 'Employee', claims.get('email') or '', role, claims.get('department'))

async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    s=get_settings()
    if s.auth_mode.lower() == 'dev':
        return CurrentUser(s.dev_user_id, s.dev_user_name, s.dev_user_email, 'admin', 'IT')
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing bearer token')
    return _oidc_user(authorization.split(' ',1)[1])
