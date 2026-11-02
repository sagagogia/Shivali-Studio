type OriginEnv={ [key:string]:string|undefined;SHIVALI_PUBLIC_ORIGIN?:string;RENDER_EXTERNAL_URL?:string};
export function appOrigin(requestUrl:string,env:OriginEnv=process.env):string {
 const configured=env.SHIVALI_PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL;
 if(!configured)return new URL(requestUrl).origin;
 const u=new URL(configured);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('Hosted public origin must be an HTTPS origin without credentials or paths');
 return u.origin;
}
export function appUrl(path:string,requestUrl:string,env:OriginEnv=process.env):string {
 if(!path.startsWith('/')||path.startsWith('//'))throw new Error('Local application path required');
 return new URL(path,appOrigin(requestUrl,env)).href;
}
export function incomingUrl(request:Request,env:OriginEnv=process.env):string {
 const url=new URL(request.url);
 if(env.SHIVALI_PUBLIC_ORIGIN||env.RENDER_EXTERNAL_URL)return new URL(url.pathname+url.search,appOrigin(request.url,env)).href;
 const host=request.headers.get('host');
 if(host){if(/[\\/@?#\s]/.test(host))throw new Error('Invalid request host');url.host=host;}
 return url.href;
}
