export function GET(request:Request) {
  return new Response(null,{status:308,headers:{location:new URL("/favicon.svg",request.url).toString(),"cache-control":"public, max-age=86400"}});
}
