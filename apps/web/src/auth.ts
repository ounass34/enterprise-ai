import Keycloak from 'keycloak-js';

const mode=import.meta.env.VITE_AUTH_MODE||'dev';
export const keycloak=mode==='keycloak' ? new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL||'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM||'enterprise',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID||'enterprise-web'
}) : null;

export async function initAuth(){
  if(!keycloak) return;
  await keycloak.init({onLoad:'login-required',checkLoginIframe:false});
}

export function authHeaders():Record<string,string>{
  return keycloak?.token ? {Authorization:`Bearer ${keycloak.token}`} : {};
}
