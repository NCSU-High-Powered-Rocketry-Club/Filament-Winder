# Build Instructions

1. Install VS Code
2. Install Marlin Autobuild & PlatformIO IDE extensions
* Ensure PlatformIO is properly installed. In C:\Users\[Your User] you should see the folder ``.platformio``.
3. Open project folder

## Building in CLI
4. Open project settings in VS Code (Ctrl + Shift + P)
5. Enter ``Preferences: Open Workspace Settings (JSON)``
6. Paste the following code into settings.json:
```
{
    "terminal.integrated.env.windows": {
        "PATH": "${env:PATH};${env:USERPROFILE}\\.platformio\\penv\\Scripts"
    },
    "terminal.integrated.defaultProfile.windows": "PowerShell"
}
```

## Building in UI
4. Click "Build" in PlatformIO