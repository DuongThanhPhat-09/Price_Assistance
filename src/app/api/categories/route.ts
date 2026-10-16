import { NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { listCategories } from "@/server/services/product-service";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => NextResponse.json(await listCategories()));
