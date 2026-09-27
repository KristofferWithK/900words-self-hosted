# 900words, built yourself

900words is a Danish vocabulary game for your phone. You play with Casey, a
suitcase with eyes. You take turns giving one-word clues on a board of Danish
words, and every word you find goes into her suitcase. 900 words can cover
over 80% of daily speech, and these are the 900 for Danish.

This is the game's source code. Build it and play it yourself, for free,
with an AI you choose.

> **Just want to play?** 900words is on the App Store: [900words.app](https://900words.app).
> This repository is for people who want to build it themselves.

## Choose Casey's AI

Casey is played by an AI model. In a self-built 900words you choose which
one, under **Settings → Casey's AI**:

| | You need | What it's like |
|---|---|---|
| **Gemma on your iPhone** | A recent iPhone (list below) and 3 GB free space | Works offline. Free and private. Slower. Experimental. |
| **Your own AI key** | An API key from an AI service | The same Casey as the App Store with Ollama Cloud's `gpt-oss:120b` |
| **Your own Casey server** | A Cloudflare account | For playing on several devices without typing your key into each one |

Your own AI key is already set up for **Ollama Cloud** and `gpt-oss:120b`,
the service and model the App Store version uses. Casey's rules, prompts and
clue books run inside the app, so with that key you get the same Casey.
Make a key at [ollama.com/settings/keys](https://ollama.com/settings/keys)
after signing in. Your use of it is between you and Ollama.

Any service that speaks the OpenAI chat API can be tried: change the
address and model in Settings. For example, a local
[Ollama](https://ollama.com) is `http://localhost:11434/v1`. Only Ollama
Cloud has been played through; another service may play a weaker Casey or
refuse the request, and **Test connection** tells you which.

Gemma runs on these iPhones: iPhone 15 Pro, 15 Pro Max, 16, 16 Plus, 16 Pro,
16 Pro Max, 16e, 17, Air, 17 Pro and 17 Pro Max. The model is Google's
Gemma 4 E4B (Apache 2.0), downloaded from Hugging Face the first time you
ask for it.

## Play in your browser

About ten minutes on any Mac, Windows or Linux computer.

1. Install [Node.js](https://nodejs.org) 22 or newer, and [git](https://git-scm.com).
2. In a terminal:

   ```bash
   git clone https://github.com/KristofferWithK/900words-self-hosted.git
   cd 900words-self-hosted
   npm ci
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) and keep the terminal
   open while you play.
4. The first time, 900words starts with a short practice round. When Casey
   first needs her AI she says so: tap **Casey settings**, keep **Your own
   AI key**, paste your key and tap **Test connection**. A tick means she is
   ready. Go back (←) and tap **Retry**.

Later, Casey's AI is under **Settings** (the cog on Home).

Next time, `cd 900words-self-hosted` and `npm run dev` is enough. To update,
`git pull` and `npm ci` first.

Your key stays in this browser and goes only to the service you set. It is
never part of a backup. Ollama Cloud does not accept requests straight from
a web page, so `npm run dev` and `npm run preview` pass them to ollama.com
for you. Nothing else goes through them.

## Play on your iPhone

Apple lets an app onto an iPhone only through the App Store, TestFlight, or
Xcode. So a self-build needs a Mac with [Xcode](https://apps.apple.com/app/xcode/id497799835)
and an Apple ID. A free Apple ID works; its builds run for 7 days before you
build again. A paid developer account ($99 a year) makes that a year.

1. Do steps 1 and 2 above on the Mac, then:

   ```bash
   npm run ios
   ```

   This builds the app and opens it in Xcode.
2. In Xcode, click **App** in the file list, then **Signing & Capabilities**.
   Choose your **Team** (your Apple ID) and change the **Bundle Identifier**
   to something only you use, such as `com.yourname.words`.
3. Plug in your iPhone, choose it at the top of the window, and press **Run** (▶).
4. The first time, the iPhone asks you to trust the developer:
   **Settings → General → VPN & Device Management**, then turn on
   **Developer Mode** if it asks (**Settings → Privacy & Security**).
5. When 900words opens, it offers to download Gemma. Say yes to play
   offline, or no to use your own AI key instead. The download is 3 GB and
   takes a few minutes on Wi-Fi. If Casey says she is not set up yet, tap
   **Casey settings** to watch the download or add a key, go back, and tap
   **Retry**.

After changing the code, run `npm run ios` again and press Run.

## Your own Casey server (optional)

The App Store version asks a Cloudflare Worker for every clue and guess.
You can deploy the same Worker, with your key as its secret, and point your
builds at it. See [docs/casey-server.md](docs/casey-server.md).

## For developers

```bash
npm run typecheck    # tsc -b (npx tsc --noEmit checks nothing here)
npm test             # unit tests (vitest)
npm run build        # production web build in dist/, with the data checks
npm run drives       # browser tests; set CHROMIUM_PATH to a Chromium first
```

- `src/`: the app (React, TypeScript, Vite). Game rules in `src/engine/`,
  Casey's app side in `src/ai/`, screens in `src/ui/`.
- `proxy/`: Casey's own logic, which the app runs in a self-build, and the
  Cloudflare Worker that runs the same logic for the App Store version.
- `ios/` and `ios-plugins/`: the Capacitor iPhone shell, Gemma's plugin,
  and a keyboard plugin fork.
- `e2e/`: browser tests that play the built app.

A self-build is chosen when the app is built: `BUILD_AUDIENCE` is
`open-source` unless you set it. It has no daily limit and no purchases, and
it sends no usage counters or shared data anywhere unless you give it your
own Casey server.

This repository is exported from 900words' development repository. Each
commit names the commit it came from.

## Licences

900words is open source with a reserved curriculum and brand:

- **Code**: [Mozilla Public License 2.0](LICENSE). Change it and share it;
  changes to these files stay open. The plugins in `ios-plugins/` keep their own
  licence files.
- **Curriculum**: the words, sentences, lessons, clues, boards and recordings
  are for your own personal use. See [CURRICULUM-LICENSE.md](CURRICULUM-LICENSE.md).
- **Brand**: the 900words name, logo, app icon and Casey are not licensed.
  See [TRADEMARKS.md](TRADEMARKS.md).
- **Other people's work** in this repository: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
