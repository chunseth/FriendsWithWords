# Words With Real Friends - React Native iOS

A React Native iOS app for Words with Friends where players compete using the same seeded letter sequence to achieve the highest score.

## Features

- **Seeded Gameplay**: Enter a seed value to play with the same letter sequence as other players
- **Word Validation**: Uses a comprehensive dictionary (370,000+ words)
- **Full Game Mechanics**: 
  - 15x15 game board with premium squares (Double/Triple Word/Letter)
  - Words with Friends tile distribution and scoring
  - Touch-friendly tile placement
  - Word history tracking
  - Score tracking and statistics
- **Native iOS App**: Built with React Native for optimal performance

## Prerequisites

- **Node.js** 18+ and npm
- **Xcode** 15+ (for iOS development)
- **CocoaPods** (for iOS dependencies)
- **React Native CLI**

### Installing Prerequisites

1. **Install Node.js**: Download from [nodejs.org](https://nodejs.org/)

2. **Install Xcode**: Download from the Mac App Store

3. **Install CocoaPods**:
```bash
sudo gem install cocoapods
```

4. **Install React Native CLI**:
```bash
npm install -g react-native-cli
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Install iOS Dependencies

```bash
cd ios && pod install && cd ..
```

### 3. Run on iOS Simulator

```bash
npm run ios
```

Or open the project in Xcode:
```bash
open ios/WordsWithRealFriends.xcworkspace
```

Then run from Xcode (⌘R).

### 4. Run on Physical Device

1. Connect your iOS device via USB
2. Open Xcode and select your device
3. Run the app (⌘R)

## Project Structure

```
WordsWithRealFriends/
├── ios/                    # iOS native project files
├── android/                # Android native project files (optional)
├── src/
│   ├── components/         # React Native components
│   │   ├── GameBoard.js
│   │   ├── TileRack.js
│   │   ├── GameInfo.js
│   │   ├── WordHistory.js
│   │   └── MessageOverlay.js
│   ├── hooks/
│   │   └── useGame.js      # Game logic hook
│   ├── utils/
│   │   └── dictionary.js   # Dictionary loader
│   └── App.js              # Main app component
├── index.js                # React Native entry point
├── package.json
└── README.md
```

## How to Play

1. **Start a Game**: 
   - Enter a seed value (or leave empty for random)
   - Tap "New Game" to begin

2. **Place Tiles**:
   - Tap tiles in your rack to select them, then tap on the board to place
   - The first word must be placed on the center square (marked with ★)

3. **Submit Words**:
   - Place tiles to form words (minimum 2 letters)
   - Words can be placed horizontally or vertically
   - Tap "Submit Word" to validate and score your words
   - All words on the board must be valid dictionary words

4. **Scoring**:
   - Each tile has a point value
   - Premium squares multiply letter or word scores
   - Using all 7 tiles in one turn gives a 50-point bonus
   - Your total score accumulates across all turns

5. **Compete**:
   - Share the same seed with friends
   - Everyone gets the same letter sequence
   - Compare scores to see who can make the best words!

## Premium Squares

- **DW** (Red): Double Word Score
- **TW** (Orange): Triple Word Score  
- **DL** (Blue): Double Letter Score
- **TL** (Green): Triple Letter Score
- **★** (Maroon): Center square - first word must use this

## Tile Values

- A, E, I, O, R, S, T: 1 point
- D, L, N, U: 2 points
- G, H, Y: 3 points
- B, C, F, M, P, W: 4 points
- K, V: 5 points
- J, Q, X, Z: 8-10 points

## Development

### Android Release Controls

See Android release policy and risk tracking:

- `docs/android-release-policy.md`
- `npm run check:android-prereqs`
- `npm run test:android-smoke`

### Running Metro Bundler

```bash
npm start
```

### Building for Production

```bash
# iOS
cd ios
xcodebuild -workspace WordsWithRealFriends.xcworkspace -scheme WordsWithRealFriends -configuration Release
```

### Debugging

- **React Native Debugger**: Install from [github.com/jhen0409/react-native-debugger](https://github.com/jhen0409/react-native-debugger)
- **Chrome DevTools**: Shake device/simulator and select "Debug JS Remotely"
- **Xcode Console**: View native logs in Xcode

## Troubleshooting

### Pod Install Issues

```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Metro Bundler Cache Issues

```bash
npm start -- --reset-cache
```

### Xcode Build Issues

1. Clean build folder: Product → Clean Build Folder (⇧⌘K)
2. Delete Derived Data
3. Reinstall pods: `cd ios && pod install && cd ..`

### "Building the app" repeats with no visible progress

The React Native CLI hides raw xcodebuild output unless a formatter is installed. You’ll only see "Building the app." cycling.

**Option A – See build output in the terminal (recommended)**  
Install [xcbeautify](https://github.com/xcbeautify/xcbeautify), then run `npm run ios` again:

```bash
brew install xcbeautify
npm run ios
```

**Option B – Build and run from Xcode**  
You get full build logs and the app launches when the build succeeds:

1. Start Metro: `npm start` (in one terminal).
2. Open the workspace: `open ios/WordsWithRealFriends.xcworkspace`.
3. In Xcode, pick a simulator and press ⌘R.

**Option C – Try verbose CLI**  
`npm run ios:verbose` (with Metro already running via `npm start`).

## Notes

- The dictionary loads from a remote source. For offline use, consider bundling it as a JS module
- The app requires network access for initial dictionary loading
- iOS deployment target: iOS 13.0+

## License

This project is open source and available for personal use.
