/**
 * Demo catalogue for a Vietnamese electrical + plumbing + hardware shop.
 * Prices are in VND (đồng). Barcodes are valid EAN-13 codes in the
 * Vietnam GS1 range (893…) but are fictional.
 */
import { makeEan13 } from "../src/lib/barcode";

export interface DemoProduct {
  barcode: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  shelfLocation: string;
  imageUrl: string;
}

type Img =
  | "pipe" | "fitting" | "valve" | "faucet" | "wire" | "bulb" | "tube"
  | "socket" | "extension" | "switch" | "breaker" | "fan" | "appliance" | "tool";

// [name, price (VND), image, description?]
type Row = [string, number, Img, string?];

const CATALOGUE: { category: string; aisle: string; rows: Row[] }[] = [
  {
    category: "Ống nước PVC",
    aisle: "A",
    rows: [
      ["Ống nước PVC Bình Minh phi 21 (cây 4m)", 32_000, "pipe", "Ống uPVC hệ inch, dày 1.6mm, dùng cấp nước sinh hoạt."],
      ["Ống nước PVC Bình Minh phi 27 (cây 4m)", 45_000, "pipe", "Ống uPVC hệ inch, dày 1.8mm, dùng cấp nước sinh hoạt."],
      ["Ống nước PVC Bình Minh phi 34 (cây 4m)", 62_000, "pipe"],
      ["Ống nước PVC Bình Minh phi 42 (cây 4m)", 85_000, "pipe"],
      ["Ống nước PVC Bình Minh phi 49 (cây 4m)", 105_000, "pipe"],
      ["Ống nước PVC Bình Minh phi 60 (cây 4m)", 140_000, "pipe", "Thường dùng làm ống thoát nước."],
      ["Ống nước PVC Bình Minh phi 90 (cây 4m)", 260_000, "pipe", "Ống thoát nước chính."],
      ["Ống nước PVC Bình Minh phi 114 (cây 4m)", 420_000, "pipe", "Ống thoát nước chính, thoát mái."],
      ["Ống nước PVC Tiền Phong phi 21 (cây 4m)", 30_000, "pipe"],
      ["Ống nước PVC Tiền Phong phi 27 (cây 4m)", 42_000, "pipe"],
      ["Ống nước PVC Tiền Phong phi 34 (cây 4m)", 58_000, "pipe"],
      ["Ống nhựa PPR nóng lạnh Dekko phi 20 (cây 4m)", 68_000, "pipe", "Chịu nhiệt tới 95°C, dùng cho bình nóng lạnh."],
      ["Ống nhựa PPR nóng lạnh Dekko phi 25 (cây 4m)", 98_000, "pipe", "Chịu nhiệt tới 95°C, dùng cho bình nóng lạnh."],
    ],
  },
  {
    category: "Phụ kiện ống nước",
    aisle: "B",
    rows: [
      ["Co 90 độ PVC Bình Minh phi 21", 3_000, "fitting"],
      ["Co 90 độ PVC Bình Minh phi 27", 4_500, "fitting"],
      ["Co 90 độ PVC Bình Minh phi 34", 7_000, "fitting"],
      ["Co 90 độ PVC Bình Minh phi 42", 11_000, "fitting"],
      ["Tê đều PVC Bình Minh phi 21", 4_000, "fitting"],
      ["Tê đều PVC Bình Minh phi 27", 6_000, "fitting"],
      ["Tê đều PVC Bình Minh phi 34", 9_500, "fitting"],
      ["Măng sông nối thẳng PVC phi 21", 2_500, "fitting"],
      ["Măng sông nối thẳng PVC phi 27", 3_500, "fitting"],
      ["Măng sông nối thẳng PVC phi 34", 5_500, "fitting"],
      ["Nối ren ngoài PVC phi 21", 4_000, "fitting"],
      ["Nối ren ngoài PVC phi 27", 5_500, "fitting"],
      ["Lơ thu giảm PVC 27 ra 21", 4_000, "fitting"],
      ["Lơ thu giảm PVC 34 ra 27", 6_000, "fitting"],
    ],
  },
  {
    category: "Van & vòi nước",
    aisle: "C",
    rows: [
      ["Van khoá nước tay gạt bằng đồng phi 21", 85_000, "valve", "Van bi đồng, ren trong, áp lực PN16."],
      ["Van khoá nước tay gạt bằng đồng phi 27", 120_000, "valve", "Van bi đồng, ren trong, áp lực PN16."],
      ["Van khoá nước tay gạt bằng đồng phi 34", 175_000, "valve"],
      ["Van một chiều lá lật bằng đồng phi 21", 95_000, "valve", "Chống nước chảy ngược về máy bơm."],
      ["Van một chiều lá lật bằng đồng phi 27", 130_000, "valve"],
      ["Van phao cơ bồn nước phi 21", 110_000, "valve", "Tự ngắt nước khi bồn đầy."],
      ["Vòi nước sân vườn đồng mạ crom", 75_000, "faucet"],
      ["Vòi lavabo nóng lạnh Inax", 650_000, "faucet"],
      ["Vòi rửa chén nóng lạnh cổ cao", 890_000, "faucet"],
      ["Bộ vòi sen tắm nóng lạnh", 1_150_000, "faucet"],
    ],
  },
  {
    category: "Dây điện",
    aisle: "D",
    rows: [
      ["Dây điện Cadivi CV 1.5 (cuộn 100m)", 620_000, "wire", "Dây đơn lõi đồng 1.5mm², dùng cho đèn, công tắc."],
      ["Dây điện Cadivi CV 2.5 (cuộn 100m)", 980_000, "wire", "Dây đơn lõi đồng 2.5mm², dùng cho ổ cắm."],
      ["Dây điện Cadivi CV 4.0 (cuộn 100m)", 1_550_000, "wire", "Dùng cho máy lạnh, bình nóng lạnh."],
      ["Dây điện Cadivi CV 6.0 (cuộn 100m)", 2_300_000, "wire", "Dây trục chính trong nhà."],
      ["Dây điện đôi Cadivi VCmd 2x1.5 (cuộn 100m)", 760_000, "wire"],
      ["Dây điện đôi Cadivi VCmd 2x2.5 (cuộn 100m)", 1_180_000, "wire"],
      ["Dây điện Trần Phú CV 1.5 (cuộn 100m)", 590_000, "wire"],
      ["Dây điện Trần Phú CV 2.5 (cuộn 100m)", 940_000, "wire"],
      ["Cáp điện Cadivi CVV 2x4 (mét)", 38_000, "wire", "Bán theo mét."],
    ],
  },
  {
    category: "Đèn LED",
    aisle: "E",
    rows: [
      ["Bóng đèn LED bulb Rạng Đông 9W", 35_000, "bulb", "Ánh sáng trắng, đui E27."],
      ["Bóng đèn LED bulb Rạng Đông 12W", 45_000, "bulb", "Ánh sáng trắng, đui E27."],
      ["Bóng đèn LED bulb Rạng Đông 15W", 55_000, "bulb"],
      ["Bóng đèn LED bulb Rạng Đông 20W", 72_000, "bulb"],
      ["Bóng đèn LED bulb Rạng Đông 30W", 110_000, "bulb"],
      ["Bóng đèn LED bulb Rạng Đông 40W", 150_000, "bulb"],
      ["Bóng đèn LED bulb Philips 9W", 48_000, "bulb"],
      ["Bóng đèn LED bulb Philips 13W", 65_000, "bulb"],
      ["Bóng đèn LED bulb Điện Quang 9W", 32_000, "bulb"],
      ["Bóng đèn LED bulb Điện Quang 12W", 42_000, "bulb"],
      ["Bóng đèn tuýp LED Rạng Đông 1m2 18W", 65_000, "tube"],
      ["Bóng đèn tuýp LED Rạng Đông 0m6 9W", 45_000, "tube"],
      ["Bộ máng đèn tuýp LED đôi 1m2", 185_000, "tube", "Gồm máng và 2 bóng 18W."],
      ["Đèn LED âm trần Rạng Đông 7W", 75_000, "bulb", "Lỗ khoét 90mm."],
      ["Đèn LED âm trần Rạng Đông 9W", 85_000, "bulb", "Lỗ khoét 110mm."],
      ["Đèn LED âm trần Rạng Đông 12W", 105_000, "bulb", "Lỗ khoét 110mm."],
      ["Đèn LED ốp trần tròn 18W", 160_000, "bulb"],
      ["Đèn LED ốp trần tròn 24W", 210_000, "bulb"],
      ["Đèn pha LED ngoài trời 50W", 290_000, "bulb", "Chống nước IP65."],
      ["Đèn pha LED ngoài trời 100W", 520_000, "bulb", "Chống nước IP65."],
      ["Đèn năng lượng mặt trời 100W", 650_000, "bulb", "Có điều khiển từ xa, tự bật khi trời tối."],
    ],
  },
  {
    category: "Ổ cắm",
    aisle: "F",
    rows: [
      ["Ổ cắm đôi Panasonic A12", 68_000, "socket", "Ổ cắm âm tường 2 chấu, có màn che."],
      ["Ổ cắm đơn Panasonic A11", 45_000, "socket"],
      ["Ổ cắm đôi âm tường Sino S18", 52_000, "socket"],
      ["Ổ cắm 3 chấu âm tường Sino S18", 58_000, "socket"],
      ["Ổ cắm kéo dài Panasonic 3m", 185_000, "extension", "4 lỗ cắm, có công tắc tổng."],
      ["Ổ cắm kéo dài Lioa 3 lỗ 3m", 95_000, "extension"],
      ["Ổ cắm kéo dài Lioa 6 lỗ 5m", 175_000, "extension", "Dây 5 mét, chịu tải 2200W."],
      ["Ổ cắm kéo dài Điện Quang 4 lỗ 2m", 89_000, "extension"],
      ["Phích cắm điện Lioa 2 chấu", 12_000, "socket"],
    ],
  },
  {
    category: "Công tắc",
    aisle: "F",
    rows: [
      ["Công tắc 1 chiều Panasonic Wide", 28_000, "switch"],
      ["Công tắc 2 chiều Panasonic Wide", 42_000, "switch", "Dùng cho cầu thang, bật tắt 2 nơi."],
      ["Công tắc 1 chiều Sino S18", 22_000, "switch"],
      ["Công tắc 2 chiều Sino S18", 32_000, "switch"],
      ["Mặt công tắc 1 lỗ Sino", 12_000, "switch"],
      ["Mặt công tắc 2 lỗ Sino", 12_000, "switch"],
      ["Mặt công tắc 3 lỗ Sino", 12_000, "switch"],
      ["Công tắc Schneider AvatarOn 1 chiều", 55_000, "switch"],
    ],
  },
  {
    category: "CB - Aptomat",
    aisle: "G",
    rows: [
      ["Aptomat Panasonic 1P 16A", 95_000, "breaker"],
      ["Aptomat Panasonic 1P 20A", 95_000, "breaker"],
      ["Aptomat Panasonic 1P 32A", 105_000, "breaker"],
      ["CB chống giật Panasonic 2P 30mA", 520_000, "breaker", "Tự ngắt khi có dòng rò, bảo vệ người dùng."],
      ["CB tép Schneider 1P 10A", 88_000, "breaker"],
      ["CB tép Schneider 1P 20A", 88_000, "breaker"],
      ["Cầu dao 2 pha 30A", 65_000, "breaker"],
      ["Tủ điện nhựa âm tường 4 đường", 145_000, "breaker"],
    ],
  },
  {
    category: "Đồ gia dụng",
    aisle: "H",
    rows: [
      ["Quạt đứng Panasonic F-400", 1_650_000, "fan", "Sải cánh 40cm, 3 tốc độ, hẹn giờ."],
      ["Quạt trần Panasonic 5 cánh", 2_450_000, "fan"],
      ["Quạt treo tường Senko TC1626", 420_000, "fan"],
      ["Quạt bàn Senko B1612", 260_000, "fan"],
      ["Quạt hút âm trần Panasonic FV-24CU", 690_000, "fan"],
      ["Nồi cơm điện Sharp 1.8 lít", 750_000, "appliance"],
      ["Nồi cơm điện Panasonic 1.8 lít", 1_290_000, "appliance"],
      ["Ấm siêu tốc Sunhouse 1.8 lít", 220_000, "appliance"],
      ["Bàn ủi khô Philips", 350_000, "appliance"],
      ["Máy sấy tóc Panasonic 1200W", 390_000, "appliance"],
      ["Bình nóng lạnh Ariston 20 lít", 2_350_000, "appliance", "Bình vuông, có chống giật ELCB."],
    ],
  },
  {
    category: "Dụng cụ & vật tư",
    aisle: "K",
    rows: [
      ["Keo dán ống PVC Bình Minh 200g", 28_000, "tool"],
      ["Băng keo điện Nano đen", 8_000, "tool"],
      ["Băng tan quấn ren", 5_000, "tool", "Quấn ren ống nước chống rò rỉ."],
      ["Bút thử điện", 25_000, "tool"],
      ["Kìm điện cắt dây 8 inch", 95_000, "tool"],
      ["Tua vít 2 đầu dẹp và bake", 35_000, "tool"],
      ["Dây rút nhựa 20cm (bịch 100 sợi)", 25_000, "tool"],
      ["Thước cuộn 5m", 45_000, "tool"],
      ["Kéo cắt ống nhựa PVC", 120_000, "tool"],
    ],
  },
];

/** Small deterministic PRNG so the demo data is identical on every seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoProducts(): DemoProduct[] {
  const rand = mulberry32(20261016);
  const out: DemoProduct[] = [];
  let seq = 0;

  for (const group of CATALOGUE) {
    group.rows.forEach(([name, price, img, description], i) => {
      seq++;
      // Margin 18–32%, cost rounded to 500đ like real price lists.
      const ratio = 0.68 + rand() * 0.14;
      const costPrice = Math.max(500, Math.round((price * ratio) / 500) * 500);

      // Mostly healthy stock, with some low and out-of-stock items to demo.
      let stockQuantity = 6 + Math.floor(rand() * 115);
      if (seq % 17 === 0) stockQuantity = 0;
      else if (seq % 11 === 0) stockQuantity = 1 + Math.floor(rand() * 4);

      const shelf = Math.floor(i / 6) + 1;
      const slot = (i % 6) + 1;

      out.push({
        barcode: makeEan13(`8934567${String(seq).padStart(5, "0")}`),
        name,
        description: description ?? null,
        category: group.category,
        price,
        costPrice,
        stockQuantity,
        shelfLocation: `${group.aisle}${shelf}-${String(slot).padStart(2, "0")}`,
        imageUrl: `/images/products/${img}.svg`,
      });
    });
  }
  return out;
}
