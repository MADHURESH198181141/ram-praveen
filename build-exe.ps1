$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""
$env:CSC_LINK = ""
$env:CSC_KEY_PASSWORD = ""

Set-Location "E:\Mini Project\retail-billing-buddy-1\retail-billing-buddy\retail-billing-buddy"
npx electron-builder --win nsis --x64 2>&1 | Tee-Object -FilePath "electron_build_final.log"
