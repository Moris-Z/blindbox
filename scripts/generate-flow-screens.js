const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const DEPS = '/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(require.resolve('playwright', { paths: [DEPS] }));
const sharp = require(require.resolve('sharp', { paths: [DEPS] }));

const CSS_VIEWPORT = { width: 440, height: 956 };
const DEVICE_SCALE = 3;
const OUTPUT_SIZE = { width: 1320, height: 2868 };
const STATE_KEY = 'nailong_blindbox_state_v6';
const SCREEN_DIR = path.join(ROOT, 'flow', 'screens');
const INDEX_PATH = path.join(ROOT, 'flow', 'index.html');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const address = {
  id: 20260603,
  name: '陈小汽',
  phone: '13800138000',
  region: '上海市 黄浦区 南京东路街道',
  detail: '汽水公寓 16 号 1608 室'
};

const demoState = {
  inventory: [1, 2, 1, 1, 1, 2],
  unlocked: [true, true, true, true, true, true],
  selection: { 1: 1, 5: 1 },
  addresses: [address],
  activeAddressId: address.id,
  editingAddressId: null,
  consent: true,
  payment: 'wx',
  purchaseRecords: [
    {
      id: 3002,
      mode: 'box',
      amount: 490,
      items: [
        { index: 1, qty: 1 },
        { index: 2, qty: 1 },
        { index: 5, qty: 1 },
        { index: 1, qty: 1 },
        { index: 3, qty: 1 }
      ],
      createdAt: '2026.06.03 15:30:12'
    },
    {
      id: 3001,
      mode: 'draw',
      amount: 98,
      items: [{ index: 0, qty: 1 }],
      createdAt: '2026.06.03 15:18:06'
    }
  ],
  shippingRecords: [
    {
      id: 9001,
      orderNo: '20260603161800901',
      createdAt: '2026.06.03 16:18:00',
      paidAt: '2026.06.03 16:18:10',
      status: '待发货',
      items: [
        { index: 1, qty: 1 },
        { index: 5, qty: 1 }
      ],
      address,
      packaging: 2,
      freight: 9.9,
      total: 11.9,
      payment: 'wx'
    }
  ],
  currentRecordTab: 'purchase',
  currentOrderId: 9001,
  addressFormOpen: false
};

const screens = [
  {
    id: '01-home',
    title: '主页',
    desc: '进入活动，查看主图、盲盒列表、概览和底部抽取入口。',
    setup: async page => {
      await reset(page);
    }
  },
  {
    id: '02-overview',
    title: '盲盒概览弹窗',
    desc: '查看总款数、常规款、隐藏款和概率信息。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => openOverlay('sheet'));
    }
  },
  {
    id: '03-detail',
    title: '盲盒详情弹窗',
    desc: '点击盲盒卡片后查看款式详情，可进入单抽或五次连抽。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => showItemModal(0));
    }
  },
  {
    id: '04-single-result',
    title: '单抽结果',
    desc: '单次抽取后展示获得款式，并提供继续单抽或五次连抽。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        closeOverlay('imageModal');
        const hit = ITEMS[0];
        $('resultTitle').innerHTML = `恭喜获得<br>${hit.name} · ${hit.type}`;
        $('resultImg').src = hit.img;
        openOverlay('resultModal');
      });
    }
  },
  {
    id: '05-five-result',
    title: '五次连抽结果',
    desc: '五次连抽后展示 5 张结果卡片，允许重复款。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        renderFiveDrawResult([1, 2, 5, 1, 3]);
        openOverlay('buyModal');
      });
    }
  },
  {
    id: '06-cabinet',
    title: '盲盒盒柜',
    desc: '查看已解锁款式和当前拥有数量。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        renderCabinet();
        showScreen('cabinetScreen');
      });
    }
  },
  {
    id: '07-shipping-select',
    title: '邮寄选择',
    desc: '选择要邮寄的盲盒，并查看选中数量和邮寄费用。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        state.selection = { 1: 1, 5: 1 };
        renderAll();
        showScreen('shippingScreen');
      });
    }
  },
  {
    id: '08-order',
    title: '确认订单',
    desc: '确认收货地址、商品明细、费用和支付方式。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        state.selection = { 1: 1, 5: 1 };
        renderAll();
        showScreen('orderScreen');
      });
    }
  },
  {
    id: '09-address',
    title: '新增地址',
    desc: '进入地址填写页，支持粘贴识别和手动填写。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        enterAddressForm('new', null);
        $('addressPaste').value = '陈小汽 13800138000 上海市 黄浦区 南京东路街道 汽水公寓 16 号 1608 室';
        $('addrName').value = '陈小汽';
        $('addrPhone').value = '13800138000';
        $('addrRegion').value = '上海市 黄浦区 南京东路街道';
        $('addrDetail').value = '汽水公寓 16 号 1608 室';
        state.consent = true;
        $('consentBtn').classList.add('on');
        $('consentBtn').textContent = '✓';
      });
    }
  },
  {
    id: '10-pay-success',
    title: '支付成功',
    desc: '支付邮费后生成邮寄订单。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        $('successOrderNo').textContent = '订单号：20260603161800901';
        $('sPack').textContent = '¥2.00';
        $('sFreight').textContent = '¥9.90';
        $('sTotal').textContent = '¥11.90';
        showScreen('orderScreen');
        openOverlay('successModal');
      });
    }
  },
  {
    id: '11-purchase-records',
    title: '购买记录',
    desc: '查看单抽和五次连抽产生的购买记录。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        state.currentRecordTab = 'purchase';
        renderRecords();
        showScreen('recordsScreen');
      });
    }
  },
  {
    id: '12-shipping-records',
    title: '邮寄记录',
    desc: '查看已生成的邮寄订单列表。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        state.currentRecordTab = 'shipping';
        renderRecords();
        showScreen('recordsScreen');
      });
    }
  },
  {
    id: '13-order-detail',
    title: '订单详情',
    desc: '查看邮寄状态、地址、明细、费用和订单信息。',
    setup: async page => {
      await reset(page);
      await page.evaluate(() => {
        state.currentOrderId = 9001;
        renderOrderDetail();
        showScreen('orderDetailScreen');
      });
    }
  }
];

async function waitReady(page) {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const isVisible = img => {
      const rect = img.getBoundingClientRect();
      const style = getComputedStyle(img);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.top <= innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    };
    const visibleImages = Array.from(document.images).filter(isVisible);
    await Promise.race([
      Promise.all(
        visibleImages.map(img => {
          if (img.complete && img.naturalWidth > 0) return true;
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      ),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
  });
  await page.waitForTimeout(180);
}
async function reset(page) {
  const fileUrl = pathToFileURL(path.join(ROOT, 'index.html')).href;
  await page.goto(`${fileUrl}?flow=${Date.now()}`, { waitUntil: 'load' });
  await waitReady(page);
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      state = JSON.parse(JSON.stringify(value));
      document.querySelectorAll('.overlay.on,.draw-layer.on').forEach(el => el.classList.remove('on'));
      document.body.classList.remove('no-scroll');
      renderAll();
      showScreen('mainScreen');
      window.scrollTo(0, 0);
    },
    { key: STATE_KEY, value: demoState }
  );
  await waitReady(page);
}

function galleryHtml(generated) {
  const cards = generated
    .map((item, index) => {
      const num = String(index + 1).padStart(2, '0');
      return `
        <section class="frame" id="${item.id}">
          <div class="meta">
            <span class="step">${num}</span>
            <div>
              <h2>${item.title}</h2>
              <p>${item.desc}</p>
            </div>
          </div>
          <img src="screens/${item.file}" width="${OUTPUT_SIZE.width}" height="${OUTPUT_SIZE.height}" alt="${num} ${item.title}">
        </section>`;
    })
    .join('\n');
  const links = generated
    .map((item, index) => `<a href="#${item.id}">${String(index + 1).padStart(2, '0')} ${item.title}</a>`)
    .join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>小汽水盲盒核心链路拆解</title>
<style>
:root{color-scheme:light;--bg:#f4fbf2;--text:#142318;--muted:#66746a;--line:#d7e8d5;--card:#fff;--green:#64d83f;}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:linear-gradient(180deg,#f7fff4,#eef9ff 50%,#fff8d7);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--text)}
.wrap{width:min(100%,1500px);margin:0 auto;padding:30px 20px 56px}
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:22px}
h1{margin:0 0 8px;font-size:30px;line-height:1.15}
.hero p{margin:0;color:var(--muted);font-size:14px;line-height:1.7}
.spec{flex:0 0 auto;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.78);font-weight:900;color:#245226}
.nav{position:sticky;top:0;z-index:5;display:flex;gap:8px;overflow:auto;padding:10px 0 16px;background:linear-gradient(180deg,rgba(247,255,244,.96),rgba(247,255,244,.72))}
.nav a{flex:0 0 auto;padding:8px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#27582a;text-decoration:none;font-size:13px;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px;align-items:start}
.frame{padding:14px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.9);box-shadow:0 12px 26px rgba(77,137,72,.12)}
.meta{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
.step{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--green);font-weight:1000;color:#0d2a0c;flex:0 0 auto}
h2{margin:0;font-size:18px;line-height:1.25}
.meta p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.55}
.frame img{display:block;width:min(100%,430px);height:auto;margin:0 auto;border-radius:8px;background:#d9f4ff;box-shadow:0 10px 24px rgba(25,63,36,.16)}
@media (max-width:720px){.hero{display:block}.spec{display:inline-block;margin-top:12px}.wrap{padding-inline:12px}.grid{grid-template-columns:1fr}.frame{padding:10px}}
</style>
</head>
<body>
<main class="wrap">
  <div class="hero">
    <div>
      <h1>小汽水盲盒核心链路拆解</h1>
      <p>按 iPhone 16 Pro Max 竖屏尺寸生成，每张图片为 ${OUTPUT_SIZE.width} × ${OUTPUT_SIZE.height} px。</p>
    </div>
    <div class="spec">${generated.length} 张屏幕图</div>
  </div>
  <nav class="nav">${links}</nav>
  <div class="grid">${cards}
  </div>
</main>
</body>
</html>`;
}

async function main() {
  fs.rmSync(SCREEN_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCREEN_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--allow-file-access-from-files', '--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: CSS_VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  const generated = [];

  for (const screen of screens) {
    await screen.setup(page);
    await waitReady(page);
    const file = `${screen.id}.png`;
    const fullPath = path.join(SCREEN_DIR, file);
    const raw = await page.screenshot({
      type: 'png',
      fullPage: false,
      animations: 'disabled'
    });
    await sharp(raw).png({ compressionLevel: 9 }).toFile(fullPath);
    const meta = await sharp(fullPath).metadata();
    if (meta.width !== OUTPUT_SIZE.width || meta.height !== OUTPUT_SIZE.height) {
      throw new Error(`${file} size mismatch: ${meta.width}x${meta.height}`);
    }
    generated.push({ ...screen, file });
    console.log(`${file} ${meta.width}x${meta.height}`);
  }

  await browser.close();
  fs.writeFileSync(INDEX_PATH, galleryHtml(generated));
  console.log(`Wrote ${INDEX_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
