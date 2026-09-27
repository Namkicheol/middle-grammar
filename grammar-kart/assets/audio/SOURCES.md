# Grammar Grand Prix 오디오 출처

카트 오디오는 CC0로 확인한 원본을 필요한 길이와 역할에 맞게 선별·정리했다. 유료 음원, Magnific 생성물, 외부 JavaScript 라이브러리는 사용하지 않았다.

- `kart-bgm.mp3`: [8-bit Epic Space Shooter Music](https://opengameart.org/content/8-bit-epic-space-shooter-music), HydroGene, CC0. 82초 루프 배경 음악.
- `kart-engine.ogg`: [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), Kenney, CC0. 주행 중 저음 엔진 루프.
- `angel.ogg`, `bomb.ogg`, `reveal.ogg`, `select.ogg`, `shield.ogg`: [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), Kenney, CC0. 각각 결승/정답, 충돌/오답, 출발, 카운트다운·선택, 부스트·아이템에 사용한다.
- `kart-skid.ogg`: [Spin](https://opengameart.org/content/spin), Rocha57, CC0. 원본 `car_spinning.wav`를 mono downmix, 90Hz high-pass/9.5kHz low-pass, fade, 0.65초로 정리해 조향·바나나 미끄러짐에 쓴다.
- `missile-whoosh.ogg`: [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds), Kenney, CC0. 원본 `thrusterFire_000.ogg`에서 0.04초부터 0.72초를 잘라 필터·fade를 적용해 미사일 발사 whoosh에 쓴다.
- `kart-impact.ogg`: [Impact Sounds](https://kenney.nl/assets/impact-sounds), Kenney, CC0. 원본 `impactPunch_heavy_000.ogg`를 0.54초로 정리해 피격·장애물 충돌 thud에 쓴다.

원본 팩의 CC0 표기와 파일 길이는 2026-09-27에 확인했다. `kart-audio.js`는 효과음 파일을 짧게 자르고 재생 속도·볼륨을 역할별로 조정하며, Web Audio API의 낮은 볼륨 음을 겹쳐서 단순 단일 삐 소리로 들리지 않게 한다.
