#!/bin/bash

# ========================================================================
# PAC (Power and Consumption) Testing Tool v1.0
# ========================================================================
# 
# WHAT THIS TOOL DOES:
# 1. [SETUP] Resets device battery stats before testing
# 2. [CREATE] Generates ADB bug reports with proper naming
# 3. [VISUAL] Launches Battery Historian for visual analysis
#
# REQUIREMENTS:
# - ADB installed and in PATH
# - Docker Desktop (for visual reports)
# - Android device connected via USB
#
# WORKFLOW:
# 1. Run setup → Wait 4h 45m → Generate report → Analyze visually
# 
# NOTE: Automated parsing was removed due to reliability issues.
# Always use the visual Battery Historian for accurate metrics.
# ========================================================================

# --- Function to display the main menu ---
show_menu() {
    echo "======================================="
    echo "  PAC (Power and Consumption) Tool v1.0"
    echo "======================================="
    echo "Please choose an option:"
    echo "  1. [SETUP] Reset Device Stats (Before Wait)"
    echo "  2. [CREATE] Generate Bug Report (After Wait)"  
    echo "  3. [VISUAL] Run Docker for Visual Report"
    echo "  q. Quit"
    echo "---------------------------------------"
    echo "💡 Tip: Always use visual analysis for accurate results"
    echo ""
}

# --- Function to execute commands and show their formatted output ---
run_and_show_reply() {
    echo "▶️ Running command: $1"
    eval "$1" 2>&1 | while IFS= read -r line; do
        echo "  ↩️  $line"
    done
    return ${PIPESTATUS[0]}
}

# --- Function for Step 1: Setup before the wait ---
run_setup_before_wait() {
    echo ""
    echo "[TASK 1] Setting up the test..."
    echo "---------------------------------------"
    
    # Verify ADB is available
    if ! command -v adb &> /dev/null; then
        echo "❌ Error: ADB not found. Please install Android SDK Platform Tools."
        echo "   Download: https://developer.android.com/studio/releases/platform-tools"
        read -p "Press [Enter] to return to the main menu."
        return
    fi
    
    # Check device connection
    echo "🔍 Checking device connection..."
    DEVICES=$(adb devices | grep -v "List of devices" | grep -c "device$")
    if [ "$DEVICES" -eq 0 ]; then
        echo "❌ Error: No Android device connected."
        echo "   Please connect your device via USB and enable USB Debugging."
        read -p "Press [Enter] to return to the main menu."
        return
    fi
    echo "✅ Found $DEVICES connected device(s)"
    
    echo "⚙️  Ensuring a fresh ADB connection..."
    run_and_show_reply "adb kill-server"
    run_and_show_reply "adb start-server"
    sleep 2

    echo "🔄 Resetting battery stats..."
    run_and_show_reply "adb shell dumpsys batterystats --reset"

    echo ""
    echo "=========================================================="
    echo "✅ SETUP COMPLETE."
    echo ""
    echo "📋 NEXT STEPS:"
    echo "1. ➡️  UNPLUG THE DEVICE NOW"
    echo "2. ⏰ START YOUR 4h 45m TIMER"
    echo "3. 📱 Use the app normally during this period"
    echo "4. 🔌 After timer ends, reconnect device"
    echo "5. 🔄 Return here to generate the bug report"
    echo "=========================================================="
    echo ""
    read -p "Press [Enter] to return to the main menu."
}

# --- Function for Step 2: Create the report after the wait ---
run_create_after_wait() {
    echo ""
    echo "[TASK 2] Creating the bug report..."
    echo "---------------------------------------"
    
    # Verify ADB and device connection
    if ! command -v adb &> /dev/null; then
        echo "❌ Error: ADB not found."
        read -p "Press [Enter] to return to the main menu."
        return
    fi
    
    DEVICES=$(adb devices | grep -v "List of devices" | grep -c "device$")
    if [ "$DEVICES" -eq 0 ]; then
        echo "❌ Error: No Android device connected."
        echo "   Please reconnect your device via USB."
        read -p "Press [Enter] to return to the main menu."
        return
    fi
    
    # Get user inputs with validation
    GAID=""
    while [ -z "$GAID" ]; do
      read -p "Enter the GAID: " GAID
      if [ -z "$GAID" ]; then
        echo "❌ GAID cannot be empty. Please try again."
      fi
    done

    VERSION=""
    while [ -z "$VERSION" ]; do
      read -p "Enter the App Version (e.g., 4.2.0.0.1): " VERSION
      if [ -z "$VERSION" ]; then
        echo "❌ Version cannot be empty. Please try again."
      fi
    done

    # Get save path with validation
    SAVE_PATH=""
    while true; do
      read -p "Enter save folder path (or press Enter for Desktop): " USER_PATH
      if [ -z "$USER_PATH" ]; then
        SAVE_PATH="$HOME/Desktop"
        if [ -d "$SAVE_PATH" ]; then
          break
        else
          echo "❌ Desktop folder not found. Please specify a valid path."
          continue
        fi
      elif [ -d "$USER_PATH" ]; then
        SAVE_PATH="$USER_PATH"
        break
      else
        echo "❌ Error: Folder '$USER_PATH' not found. Please try again."
      fi
    done
    echo "✅ Report will be saved in: $SAVE_PATH"

    # Generate filename with current date
    DATE=$(date +%d%m%y)
    FILENAME="pac_${GAID}_${VERSION}_${DATE}.zip"
    FILEPATH="$SAVE_PATH/$FILENAME"

    # Check if file already exists
    if [ -f "$FILEPATH" ]; then
        echo "⚠️  File already exists: $FILENAME"
        read -p "Overwrite? (y/N): " OVERWRITE
        if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
            echo "❌ Operation cancelled."
            read -p "Press [Enter] to return to the main menu."
            return
        fi
    fi

    echo ""
    echo "⏳ Generating ADB bug report... This may take 5-10 minutes."
    echo "📱 Please keep the device connected and unlocked."
    echo ""
    
    echo "▶️ Running command: adb bugreport \"$FILEPATH\""
    
    # Run bugreport with progress indicator
    adb bugreport "$FILEPATH" > /dev/null 2>&1 &
    PID=$! 
    SPINNER='|/-\'
    i=0
    while kill -0 $PID 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r[%c] Generating report... Please wait" "${SPINNER:$i:1}"
        sleep .3
    done
    printf "\r[✓] Report generation completed!     \n"

    # Verify file was created successfully
    if [ ! -f "$FILEPATH" ]; then
      echo "❌ Error: Failed to create the bug report."
      echo "   Please ensure:"
      echo "   - Device is connected and unlocked"
      echo "   - USB Debugging is enabled" 
      echo "   - You have write permissions to the save folder"
    else
      FILESIZE=$(ls -lh "$FILEPATH" | awk '{print $5}')
      echo ""
      echo "=========================================================="
      echo "✅ Bug report created successfully!"
      echo ""
      echo "📁 File: $FILENAME"
      echo "📂 Location: $SAVE_PATH"
      echo "📏 Size: $FILESIZE"
      echo ""
      echo "📋 NEXT STEPS:"
      echo "1. 🐳 Use option 3 to launch Battery Historian"
      echo "2. 🌐 Upload the .zip file to analyze results"
      echo "3. 📊 Review battery, network, wakelock, and job metrics"
      echo "=========================================================="
    fi
    echo ""
    read -p "Press [Enter] to return to the main menu."
}

# --- Function for Step 3: Run Docker for the visual report ---
run_docker_visual_report() {
    echo ""
    echo "[TASK 3] Starting Battery Historian Visual Tool..."
    echo "---------------------------------------"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "❌ Error: Docker not found."
        echo "   Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        read -p "Press [Enter] to return to the main menu."
        return
    fi

    echo "⚙️ Checking Docker status..."
    docker info >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ Error: Docker is not running."
        echo ""
        echo "📋 Please:"
        echo "1. Start Docker Desktop application"
        echo "2. Wait for it to fully initialize (usually 1-2 minutes)"
        echo "3. Try this option again"
        echo ""
        read -p "Press [Enter] to return to the main menu."
        return
    fi
    echo "✅ Docker is running."
    
    # Check if port 9999 is already in use
    if lsof -Pi :9999 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port 9999 is already in use."
        echo "🌐 Battery Historian might already be running at: http://localhost:9999"
        read -p "Continue anyway? This will stop any existing container. (y/N): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            echo "❌ Operation cancelled."
            read -p "Press [Enter] to return to the main menu."
            return
        fi
        echo "🛑 Stopping existing container..."
        docker stop $(docker ps -q --filter "ancestor=gcr.io/android-battery-historian/stable:3.1") 2>/dev/null || true
    fi
    
    echo "🐳 Starting the Battery Historian Docker container..."
    echo "   This may take a few minutes on first run (downloading image)..."
    
    CONTAINER_ID=$(docker run -d -p 9999:9999 gcr.io/android-battery-historian/stable:3.1 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$CONTAINER_ID" ]; then
        echo ""
        echo "=========================================================="
        echo "🚀 Battery Historian is now running!"
        echo ""
        echo "🌐 Open your web browser and go to:"
        echo "   http://localhost:9999"
        echo ""
        echo "📋 USAGE INSTRUCTIONS:"
        echo "1. Click 'Choose File' and select your .zip report"
        echo "2. Click 'Submit' to upload and process"
        echo "3. Review the visual analysis results"
        echo "4. Focus on: Battery, Network, Wakelocks, Jobs sections"
        echo ""
        echo "🛑 To stop Battery Historian later:"
        echo "   docker stop $CONTAINER_ID"
        echo "=========================================================="
        echo ""
        
        # Offer to open browser automatically (macOS)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            read -p "Open Browser automatically? (Y/n): " OPEN_BROWSER
            if [[ ! "$OPEN_BROWSER" =~ ^[Nn]$ ]]; then
                open "http://localhost:9999" 2>/dev/null || echo "Could not auto-open browser."
            fi
        fi
    else
        echo "❌ Error: Failed to start Battery Historian container."
        echo "   This could be due to:"
        echo "   - Docker daemon not running"
        echo "   - Network connectivity issues"
        echo "   - Port 9999 permission issues"
        echo ""
        echo "💡 Try: docker run -d -p 9999:9999 gcr.io/android-battery-historian/stable:3.1"
    fi
    echo ""
    read -p "Press [Enter] to return to the main menu."
}

# --- Display usage instructions on first run ---
show_welcome() {
    echo ""
    echo "========================================================================"
    echo "🔋 Welcome to PAC (Power and Consumption) Testing Tool v1.0"
    echo "========================================================================"
    echo ""
    echo "📋 TESTING WORKFLOW:"
    echo "1. Connect Android device via USB (enable USB Debugging)"
    echo "2. Run [SETUP] to reset battery stats"
    echo "3. Unplug device and wait 4h 45m while using the app"
    echo "4. Reconnect device and run [CREATE] to generate report"
    echo "5. Use [VISUAL] to analyze results with Battery Historian"
    echo ""
    echo "⚠️  IMPORTANT: Always use visual analysis for accurate metrics"
    echo "    Automated parsing was removed due to reliability issues"
    echo ""
    echo "🎯 SUCCESS CRITERIA (check in visual report):"
    echo "   Battery Usage: < 1% (Green), < 2% (Yellow), > 2% (Red)"
    echo "   Network: < 1MB (Green), < 10MB (Yellow), > 10MB (Red)" 
    echo "   Wakelocks: < 10 (Green), < 50 (Yellow), > 50 (Red)"
    echo "   JobScheduler: < 5 (Green), < 20 (Yellow), > 20 (Red)"
    echo ""
    echo "========================================================================"
}

# --- Main execution ---
show_welcome

# Main loop to run the tool
while true
do
    show_menu
    read -p "Enter your choice: " choice
    case $choice in
        1)
            run_setup_before_wait
            ;;
        2)
            run_create_after_wait
            ;;
        3)
            run_docker_visual_report
            ;;
        q|Q)
            echo ""
            echo "========================================="
            echo "👋 Thank you for using PAC Testing Tool!"
            echo "========================================="
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Invalid option '$choice'. Please choose 1, 2, 3, or q."
            sleep 1
            ;;
    esac
done
