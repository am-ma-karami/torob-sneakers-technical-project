export async function api<T>(path:string, signal?:AbortSignal, body?:unknown):Promise<T> {
 const response=await fetch('/api'+path,{signal,method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
 if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error?.message || 'ارتباط با کاتالوگ برقرار نشد')}
 return response.json() as Promise<T>
}
