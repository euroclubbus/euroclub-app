export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const apiPath = url.pathname.replace('/api/proxy', '') + url.search
  const target = `https://eclub.com.ua/api${apiPath}`
  
  const response = await fetch(target, {
    method: req.method,
    headers: { 'Accept': 'application/json' }
  })
  
  const data = await response.text()
  
  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  })
}
