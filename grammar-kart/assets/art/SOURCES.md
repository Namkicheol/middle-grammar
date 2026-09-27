# Grammar Grand Prix 아트 출처

- `kart-rear-teal.webp`, `kart-left-teal.webp`, `kart-right-teal.webp`: OpenAI GPT image generation, 2026-09-27. Corrected transparent atlas generation: direct symmetric rear, screen-left yaw/lean, and screen-right yaw/lean poses.
- `kart-rear-red.webp`, `kart-left-red.webp`, `kart-right-red.webp`: the same corrected atlas generation for the red sporty kart.
- `kart-rear-yellow.webp`, `kart-left-yellow.webp`, `kart-right-yellow.webp`: the same corrected atlas generation for the yellow chunky rally kart.
- `kart-turn-atlas.webp`: corrected transparent 3×3 atlas at 768×768; rows are teal/red/yellow and columns are direct-rear/steer-left/steer-right. Each frame is 256×256.
- `neon-circuit-bg.webp`: OpenAI GPT image generation, 2026-09-27. Original wide circuit scene, exported to 1024×512 WebP for a low-spec Canvas2D background.
- `garage-bg.webp`: OpenAI GPT image generation, 2026-09-27. Original vehicle-free cyan/orange pit garage with an empty left presentation plinth and darker right UI-safe panel; exported to 1440×810 WebP (about 113KB).
- `kart-showcase-teal.webp`, `kart-showcase-red.webp`, `kart-showcase-yellow.webp`: OpenAI GPT image generation, 2026-09-27, using the corresponding original kart sprites as visual references. Transparent rear-three-quarter hero renders, exported as 512×512 WebP for the garage/showroom selection screen.

생성 원본은 프로젝트 표시 크기에 맞춰 알파 가장자리와 해상도를 정리했다. 주행 포즈와 입장 화면용 전시 자산은 별도 파일로 제공하며, 생성 이미지에는 기존 게임·캐릭터·로고를 참조하지 않았다. 주행 자산은 성능 차이가 없고, 쇼케이스 이미지는 외형 선택용이다.
