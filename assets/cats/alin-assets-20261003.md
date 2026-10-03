# 阿琳的新素材

2026-10-03，阿琳在本轮对话中提供并授权用于奶团小屋的两张 1774 × 887 图集。

- `assets/cakes/alin-cakes-20261003.png`：原透明 PNG 直接使用，8 款蛋糕从左至右、从上至下映射到收藏编号 8–15。
- `assets/cats/alin-heads-20261003.png`：8 个原猫头保留原尺寸、位置和画风，通过 Codex 内置 `imagegen.imagegen` 去除原 RGB 图片的纯黑背景；映射到猫种编号 11–18。
- 游戏不直接用图集：按原 4 × 2 格子把猫头裁成 `cat11.webp`–`cat18.webp`（360 × 360），蛋糕按原取景框和轮廓裁成 `cake8.webp`–`cake15.webp`（300 × 300），没有重画。手机上一张张小图比从大图集取景省力；两张 PNG 图集留作源文件。角色与素材权利沿用项目素材许可。

猫图编辑参数：`transparent_background: true`，`referenced_image_paths` 使用阿琳提供的第二张素材。实际提示词：

```text
Edit the provided cat-head sprite sheet by removing ONLY the solid black background and making it truly transparent. Preserve all eight original hand-painted cat heads, their exact colours, brown outlines, eyes, whiskers, shapes, scale, orientation, spacing and their 4-column by 2-row arrangement. This is precise background removal for game assets, not redesign: do not invent cats, add details, alter art style, change colour, add shadows, or move heads. All eight heads must be complete, without clipping any whiskers or ears. Keep the original wide 2:1 canvas framing and original positions. Export one transparent PNG sprite sheet. The black background should become alpha=0, while the dark brown outlines and all original internal colours remain fully opaque.
```
