import { accessRole } from "../../../admin-access";

export async function GET(request:Request) {
  return Response.json({role:await accessRole(request)},{headers:{"cache-control":"no-store"}});
}
