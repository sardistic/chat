# Chat - Next-chat WebRTC & IRC Chat chat

A h͡i͍͇ǵ̠̆h͔ͪ͘-f̯̼͠i͛͂͏d͏̮̌e͠l̩̔͒i͇͉̕tͤyͪ̓͌, Discord-inspired video chat ą͖̈́p̮p̝͇ͭl͐͂̚i̘̍c̬̘a̡̙̐t̸̑i̫̯͢o̹͊n̢̞ blending W͍̋̀e̘͊̾b͂Ȓ̜ͧṮC̶̝̉ p͍ͦ̀e̍̏è̺͡ṛ̣-t͓̒o͑͊-p̷̰ȩ̃ͬe̠̾r͎ streaming with a robust IRC bridge. Built for performance, aesthetics, and c͙o͉͇̿ṁ̫m͗u̵̶ͩn̉͜i̝ͧt̀y͖͇̓ management.

## :: Features

### [C͝A̧͉Ḿ] C̋͛o̷̬̐r͊e̲̎ C̞ͭŏ̝ͅm̯͢͝m͢u̝̝̓n̰͋͠i̸ͅc͚a̢t̉̍͋ḭͦ͠o̽ňͅś͔̲
- **WebRTC Video/Audio**: Low-latency mesh network for v͐i̳͐ḑͦ̓e͋ͫo̱̓/a͊u̫͋d̝̦̓i̦o̶͌ͬ.
- **IRC B̵̲r͗̅í͇ͮd̩g͢e̩ͣ**: Seamless integration with IRC (e.g., GameSurge) for text chat.
- **YouTube S̱y͡n̄c̶ͧ**: Watch videos together in real-time (synced p̘̉ḽ͙͊a͈y͎b͊̄̈a̩̬c͚ǩ).
- **S̙̣͒c͕͗̎r͈̊e̦̼ë̘̩n̏ Sharing**: B̡́͟r̶ͤö͉́ád͇̜̓ç̘̀a͘s͂t͞ your screen to the r̗͕ͬo̺͔o̴mͮ.

### [SEC] Moderation & Safety (M͈̓ḯs͗͜s̪͑͠ï͚̉o̚n̵͖̑ Control)
- **Role System**: Ó̝͔w̡͋n͍̩͌eͫr͈̫, A͖ͣd͓́m̅͜͠i̺͍̐n̝̽, Moderator, User, Guest.
- **Actions**: Kick, Ban, Shadow Mute, Message Wiping.
- **Camera Control**: Moderators can force-disable cameras or ban broadcasting for s̑̀͋p͕̽e̗c͏͑i̮̞̪f̱i͆c͆ users.
- **Safety Tools**: IP tracking, alt-detection, and block ļ̟i̖ͧs͉t̓s̠̺.

### [ART] Immersive UI/UX
- **Interactive Backgrounds**:
  - **StarMap**: 3D WebGL galaxy with mouse interaction (T͇hͧ͜ͅr̙̐e̔e̷̓̕.j̉͂s̹̈͞).
  - **Fluid D̒ó̫͜t͂͘G̟ͤṟ̍ȋ̋d̫̾**: Reactive particle s̠ͭ̓y̚s̸t̒e̖͌̅m̻͜s̙͍͋.
  - **P̏̓ë̢̢́r̢f̈͗oͫř̖ͭm̖ͦa͎̫̗n̼c͏̝ͅé͒̋ Mode**: Low-resource static option.
- **F̬̈́ͨr̟̠͒a̸̡̦mͥͧẽ̏r̉ Motion**: Smooth ȩ̈n̿̈́t͓̊r͓y̞̺͘/e̵̗x̋ͩi̧͟t̏ animations and draggable w̵̸ͤì͕̅n̍dͪo͔̅̚w͂s͌ͩͅ.
- **Glassmorphism**: Premium dark UI with b̡̥l͕ǘ͐r̺ effects.
- **Mobile Optimized**: Responsive layout w̪̱̙i̗t̵̍͠h̖ swipe/drag gestures.

### [Ȋ͜D̡̦͢] Identity & Customization
- **Profiles**: Custom avatars, banners, and b̲̂i̲͂o̴̒́ŝ̗.
- **Discord Integration**: Login w̛͂i̧̝͙t͋h̃ Discord to sync avatar and badges.
- **R̜̗ôȯ̬͢m̗ Settings**: C̊u̗̒̐s̾t̛̊ő͍͠m͋ͫiͫz̨̘͘è̝͈ room name, icon, and banner.

## [SYS] Tech Stack

- **Framework**: Ṇ͑e͉̦͓x̢t̆.j̮̘ṣ͍͒ 16 (App R̫̊̆o̙u̟̲̪t̅̽e̯̋ṛ͌̑)
- **UI Library**: React 19
- **Animations**: Framer Motion, Three.js, Vͭ͊a͖͎n͈t͙aͦͥ̚.j̛ͬs͛ͩ
- **Real-time**: Socket.IO + Redis Adapter
- **Database**: PostgreSQL (via Prisma O̩̤Ȓ͈͘Ṃ̿͟)
- **Styling**: TailwindCSS + CSS Modules
- **WebRTC**: SimplePeer
- **IRC**: irc-framework

## >> Quick Start

1. **Ȉ̼ͅn̜̆̚s̛̅̇ṱaͮlͮl̿̉̅ Dependencies**
   ```bash
   npm install
   ```

2. **Environment S̓e͒t̢̃̋u̘̗͝p̐**
   C̫̒̇r͢eͧ͡a̱͆̎t͎́͏e̢̤̓ a `.env` file with:
   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_SECRET="supersecret"
   D̷̀Ȋ̞̆S͂͘C͙ͧO̴͚R͖D̵_C̲L̷̛̤I̱E͘N͉Ṯͫ_I͙̤̥D̠̲͉="..."
   DISCORD_CLIENT_SECRET="..."
   IRC_HOST="irc.gamesurge.net"
   IRC_CHANNEL="#camrooms"
   ```

3. **Database**
   ```bash
   npx prisma db push
   ```

4. **Run Development S͘e̼̕͢r̞͞v͇̰ͅe͚r̰͙͢**
   ```bash
   npm run dev
   ```

## [CMD] IRC Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/join` | `/j̉͏͡o̵̼ͬiͦ̒͑ņ̷ #channel` | Join an IRC channel |
| `/n͢í̲c͕͑ͦk̠̥` | `/n̗̦i̝ͥ͘c̰̮ͮk͚̳̿ Name` | Change your d̴̲̏i̚s̯͙ͦp̮̄l̯͋a̚͟y͈̏ n͑a̡̖͆m̟e̤̔ |
| `/me` | `/me w̤ͪ́a̮̤v̷̉̀e̸̱͋s̩` | Send an action message |
| `/msg` | `/msg User Hi` | Send private message (IRC only) |
| `/c̙͍̾l͒e̳ͣ̌a̯̻̽r͍͉͗`| `/clear` | Clear local chat history |
| `/topic`| `/t̑o͔̠p̹̽̕i̽c̸̪ New Topic`| Set the ċͣ̚h̻͎a͐n̴̖̔n̟̉eͭ̀͐l͈ topic |

## [D̓I̟R̠̺] Architecture

The application uses a hybrid aͣp̱p̼̬r͟o͓aͣc̻ḩ̛:
- **Signaling Server**: Socket.IO ẖ̦̓a̸̷n̴̑͟d̡͂́l͒͛͡e̗̅ͬsͪ͢ W̖̐eͫͧḇ̉R̲̅T̊̄C̘̭̽ h͎a͜n̔ͤd͋sͅhͫ̀a̶k̳ͫ͝e͉̚s͙͂ and chat m̨̿e͘s̩ͧs̿a͇g̏ë́s̼̀̒.
- **M͋e̶̲̙s̤ͭ̌h̵̳ Topology**: Video/Audio is P2P (U̪s͆ͭe̬ṙ-t͕o̴-U͛ͫs̨̘e̷͓r̜).
- **Persistence**: Prisma/Postgres stores users, rooms, and m̪͈̄ő̙̺ḍ͡e̟̔rͨa̯͇t͕͔̱i͑o̶n̢͂͡ logs.
- **I͉ͣ̆R̆C̖͘͡ Bot**: A server-side bot bridges socket messages to the IRC network.

## [SOC] Contributing

1. F̜o̹̟͆r͂k̑͏ the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. P͟ų͚ͅs̙̙ͭh̷̛ to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## [DOC] License

M̰ͪ͑Į̿T̯͋
