#!/bin/bash

# Setup script for React Native iOS project

echo "🚀 Setting up Words With Real Friends for iOS..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check for CocoaPods
if ! command -v pod &> /dev/null; then
    echo "⚠️  CocoaPods not found. Installing..."
    sudo gem install cocoapods
fi

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Initialize React Native project if iOS folder doesn't exist
if [ ! -d "ios" ]; then
    echo "📱 Initializing React Native iOS project..."
    npx @react-native-community/cli@latest init WordsWithRealFriends --skip-install --directory temp_init
    
    if [ -d "temp_init/ios" ]; then
        cp -r temp_init/ios .
        cp -r temp_init/android .
        rm -rf temp_init
        echo "✅ iOS project initialized"
    else
        echo "⚠️  Could not auto-initialize iOS project. Please run manually:"
        echo "   npx react-native init WordsWithRealFriends --skip-install"
        echo "   Then copy the ios/ folder to this directory"
    fi
fi

# Install CocoaPods dependencies
if [ -d "ios" ]; then
    echo "🍫 Installing CocoaPods dependencies..."
    cd ios
    pod install
    cd ..
    echo "✅ CocoaPods dependencies installed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open the project in Xcode:"
echo "   open ios/WordsWithRealFriends.xcworkspace"
echo ""
echo "2. Or run on iOS simulator:"
echo "   npm run ios"
echo ""

