# Grammar Grand Prix 오디오 출처

게임에서 쓰는 음악·효과음은 CC0로 공개된 원본을 필요한 길이와 역할에 맞게 선별·정리했다. 유료 음원, 생성형 음원, 외부 JavaScript 라이브러리는 사용하지 않았다.

- `kart-race.mp3`: [Hyper Ultra-Racing](https://opengameart.org/content/hyper-ultra-racing), cynicmusic, CC0. OpenGameArt 페이지에서 racing / drum and bass로 소개한 곡. 원본 `AugustUltraAmbience.wav` (44.1 kHz stereo, 79.70초)를 MP3 128 kbps stereo로 인코딩했다 (1,276,073 bytes).
- `kart-engine.mp3`: [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), Kenney, CC0. `kart-engine.ogg` 원본을 MP3 128 kbps로 인코딩했다. 주행 중 저음 엔진 루프.
- `kart-impact.mp3`: [Impact Sounds](https://kenney.nl/assets/impact-sounds), Kenney, CC0. `kart-impact.ogg` 원본을 MP3 128 kbps로 인코딩했다. 피격·장애물 충돌 thud.
- `kart-skid.mp3`: [Spin](https://opengameart.org/content/spin), Rocha57, CC0. `kart-skid.ogg` 원본을 MP3 128 kbps로 인코딩했다. 원본 `car_spinning.wav`를 mono downmix, 90 Hz high-pass / 9.5 kHz low-pass, fade, 0.65초로 정리한 조향·미끄러짐 소리.
- `missile-whoosh.mp3`: [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds), Kenney, CC0. `missile-whoosh.ogg` 원본을 MP3 128 kbps로 인코딩했다. 원본 `thrusterFire_000.ogg`에서 0.04초부터 0.72초를 잘라 필터·fade를 적용한 부스트·미사일 발사 whoosh.
- `angel.mp3`, `bomb.mp3`, `reveal.mp3`, `select.mp3`, `shield.mp3`: [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds), Kenney, CC0. 각각 `angel.ogg`, `bomb.ogg`, `reveal.ogg`, `select.ogg`, `shield.ogg` 원본을 MP3 128 kbps로 인코딩했다. 결승, 충돌, 출발, 카운트다운·선택, 부스트·아이템에 사용한다.

MP3는 iOS Safari를 포함한 브라우저 재생용이다. OGG 원본은 기존 CC0 출처를 보존하고, `kart-audio.js`는 MP3 재생이 실제로 거부될 때만 Web Audio 대체음을 예약한다. 원본 팩의 CC0 표기와 파일 길이는 2026-09-27에 확인했다. `kart-race.mp3`의 출처 페이지와 라이선스는 2026-10-02에 확인했다.

`kart-race.mp3` 인코딩 재현 명령:

```sh
curl --fail --location --silent --show-error --output /tmp/AugustUltraAmbience.wav https://opengameart.org/sites/default/files/AugustUltraAmbience.wav
ffmpeg -hide_banner -loglevel error -nostdin -y -i /tmp/AugustUltraAmbience.wav -map 0:a:0 -map_metadata -1 -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 grammar-kart/assets/audio/kart-race.mp3
```

기존 OGG에서 재생용 MP3를 만드는 명령 (각 파일에 같은 옵션 적용):

```sh
ffmpeg -hide_banner -loglevel error -nostdin -y -i INPUT.ogg -map 0:a:0 -map_metadata -1 -codec:a libmp3lame -b:a 128k -ar 44100 OUTPUT.mp3
```

이전 후보 `kart-bgm.mp3`와 `race-v2.mp3`는 현재 `kart-audio.js`에서 참조하지 않는다.
