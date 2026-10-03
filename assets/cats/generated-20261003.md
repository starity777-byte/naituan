# 新猫头像生成记录

2026-10-03，通过 Codex 内置 `imagegen.imagegen` 生成；透明 PNG，1280 × 1280。原猫头为风格和取景参考，不作为编辑目标。每次仅生成一只猫。

参考素材：`assets/cats/cat0.webp`、`cat3.webp`、`cat6.webp`。参数：`transparent_background: true`。

| 文件 | 猫种 | 提示词中的 subject |
| --- | --- | --- |
| `cat8.png` | 布偶 | a fluffy white and pale dove-grey Ragdoll cat with soft blue dot eyes and a cream forehead, broad fluffy cheeks |
| `cat9.png` | 缅因 | a warm cocoa-brown Maine Coon cat, distinguishable pointed ears with small dark ear tufts, cream muzzle and round dark dot eyes |
| `cat10.png` | 波斯 | a pale peach-cream Persian cat, very round fluffy face, tiny low ears, dark dot eyes and a subtly flat tiny muzzle |

以下为实际共用提示词；`{subject}` 分别替换为表内的完整描述：

```text
Use case: illustration-story. Asset type: a single transparent cat-head game sprite for the personal mobile game 奶团小屋. The attached images are STYLE AND FRAMING REFERENCES ONLY, not edit targets. Create {subject}. Match the references closely: simple handmade 2D doodle, warm dark-brown thick softly wobbly outline, flat muted cream colours, minimal facial features, dot eyes, tiny w-shaped mouth, two simple whiskers per cheek, cute calm expression, nearly circular head filling about 85% of a square canvas. Front view, head only, no body, no accessories, no environment, no shadow outside the silhouette, no lettering. Readable and distinct at 40 pixels. Real transparent background; preserve alpha. This is one isolated cat sprite, not a sheet.
```

游戏加载的是缩到 360 × 360 的 `cat8-10.webp`（每张约 25 KB）；1254 × 1254 的 PNG 留作源文件。
