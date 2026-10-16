import { describe, expect, it } from "vitest";
import { toW3CFormat } from "@/lib/barcode-detector";

describe("toW3CFormat", () => {
  it("maps ZXing-C++ format names to W3C BarcodeDetector names", () => {
    expect(toW3CFormat("EAN-13")).toBe("ean_13");
    expect(toW3CFormat("EAN13")).toBe("ean_13");
    expect(toW3CFormat("UPC-A")).toBe("upc_a");
    expect(toW3CFormat("Code 128")).toBe("code_128");
    expect(toW3CFormat("QR Code")).toBe("qr_code");
  });

  it("reports unknown formats instead of throwing", () => {
    expect(toW3CFormat("Telepen")).toBe("unknown");
  });
});
