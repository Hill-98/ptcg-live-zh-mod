;@Ahk2Exe-Let APP_NAME = PTCGLiveZhModManager
;@Ahk2Exe-Let APP_VERSION = 0.1.0.1
;@Ahk2Exe-ExeName %A_ScriptDir%\bin\Release\Manager\%U_APP_NAME%.exe
;@Ahk2Exe-SetCopyright Hill-98@GitHub
;@Ahk2Exe-SetDescription %U_APP_NAME%
;@Ahk2Exe-SetLanguage 0x0804
;@Ahk2Exe-SetName %U_APP_NAME%
;@Ahk2Exe-SetOrigFilename %A_ScriptName%
;@Ahk2Exe-SetVersion %U_APP_VERSION%

#NoTrayIcon
#SingleInstance Force
#Include %A_ScriptDir%

ASSET_LATEST_VERSION := 2024030601
WINDOW_TITLE := "Pokemon TCG Live 中文化模组管理器"

class InstallError extends Error {
}

class UninstallError extends Error {
}

SafeDirDelete(name, recurse := false) {
    try {
        DirDelete(name, recurse)
    } catch Error {
    }
}

SafeFileDelete(pattern) {
    try {
        FileDelete(pattern)
    } catch Error {
    }
}

; TODO: 待实现
checkUpdateValid(localVersion) {
    return true
}

GetPTCGLiveInstallDirectory() {
    SetRegView(64)
    PTCGLiveInstallDirectory := RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{CF1C9860-7621-43C3-AA53-13A95631CBED}", "InstallLocation", "") . "Pokémon Trading Card Game Live"

    if (!FileExist(PTCGLiveInstallDirectory . "\Pokemon TCG Live.exe")) {
        MsgBox("未找到 Pokemon TCG Live 可执行文件，请手动选择可执行文件。", WINDOW_TITLE, 0x30)
        result := FileSelect(1, A_Desktop, "选择 Pokemon TCG Live 可执行文件", "Pokemon TCG Live.exe (Pokemon TCG Live.exe; *.lnk)")
        if (result == "") {
            return false
        }
        if (InStr(result, ".lnk", 0) == StrLen(result) - 3) {
            FileGetShortcut(result, &target)
            SplitPath(target, , &PTCGLiveInstallDirectory)
        } else {
            SplitPath(result, , &PTCGLiveInstallDirectory)
        }
    }

    if (InStr(PTCGLiveInstallDirectory, "\") == StrLen(PTCGLiveInstallDirectory)) {
        PTCGLiveInstallDirectory := SubStr(PTCGLiveInstallDirectory, 0, StrLen(PTCGLiveInstallDirectory) - 1)
    }

    return PTCGLiveInstallDirectory
}

InstallAbort(text) {
    MsgBox(text . "`n`n安装步骤中止。", WINDOW_TITLE, 0x10)
    ExitApp()
}

UninstallAbort(text) {
    MsgBox(text . "`n`n卸载步骤中止。", WINDOW_TITLE, 0x10)
    ExitApp()
}

InstallMain(assetsPath := "") {
    global PTCGLiveInstallDirectory, ModDirectory, ModAssetsDirectory, ModDatabaseDirectory, ModFontsDirectory, ModTextDirectory

    FileInstall("bin\Release\Manager\BepInEx.zip", PTCGLiveInstallDirectory . "\BepInEx.zip", 1)
    code := RunWait("cmd.exe /c PowerShell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy AllSigned -Command Expand-Archive -LiteralPath BepInEx.zip -DestinationPath . -Force -ErrorAction Stop >powershell.log 2>&1", PTCGLiveInstallDirectory)
    FileDelete(PTCGLiveInstallDirectory . "\BepInEx.zip")
    if (code != 0) {
        throw InstallError("释放 BepInEx 到 Pokemon TCG Live 安装目录失败。`n`n" . FileRead(PTCGLiveInstallDirectory . "\powershell.log"))
    }
    FileDelete(PTCGLiveInstallDirectory . "\powershell.log")

    DirCreate(ModDirectory)
    DirCreate(ModDatabaseDirectory)
    DirCreate(ModFontsDirectory)
    DirCreate(ModTextDirectory)

    FileInstall("bin\Release\netstandard2.0\PTCGLiveZhMod.dll", ModDirectory . "\PTCGLiveZhMod.dll", 1)
    FileInstall("bin\Release\Manager\names.txt", ModDatabaseDirectory . "\names.txt", 1)
    FileInstall("fonts\arialuni_sdf_u2019.asset", ModFontsDirectory . "\arialuni_sdf_u2019", 1)
    FileInstall("text\startup.txt", ModTextDirectory . "\startup.txt", 1)

    if (!FileExist(assetsPath)) {
        return
    }

    if (!InStr(assetsPath, "update.assets.zip")) {
        SafeDirDelete(ModAssetsDirectory, true)
    }
    DirCreate(ModAssetsDirectory)

    if (FileExist(ModAssetsDirectory . "\AssetsLocation")) {
        FileDelete(ModAssetsDirectory . "\AssetsLocation")
    }
    FileAppend(assetsPath, ModAssetsDirectory . "\AssetsLocation", "UTF-8")

    code := RunWait("cmd.exe /c PowerShell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy AllSigned -Command Expand-Archive -LiteralPath $(Get-Content -Path AssetsLocation -Encoding utf8 -ErrorAction Stop) -DestinationPath . -Force -ErrorAction Stop >powershell.log 2>&1", ModAssetsDirectory)
    FileDelete(ModAssetsDirectory . "\AssetsLocation")
    if (code != 0) {
        throw InstallError("释放中文化资源文件到 MOD 目录失败。`n`n" . FileRead(ModAssetsDirectory . "\powershell.log"))
    }
    FileDelete(ModAssetsDirectory . "\powershell.log")
}

UninstallMain(withBepInEx := false) {
    global PTCGLiveInstallDirectory, ModDirectory

    SafeFileDelete(PTCGLiveInstallDirectory . "\winhttp.dll.bak")

    if (withBepInEx) {
        SafeFileDelete(PTCGLiveInstallDirectory . "\doorstop_config.ini")
        SafeFileDelete(PTCGLiveInstallDirectory . "\winhttp.dll")
        SafeDirDelete(PTCGLiveInstallDirectory . "\BepInEx", true)
    } else {
        SafeDirDelete(ModDirectory, true)
    }
}

InstallButton_Click(button, info) {
    global MainWindow
    MainWindow.Hide()

    DISCLAIMER := A_Temp . "\" . A_ScriptName . ".DISCLAIMER.txt"
    FileInstall("DISCLAIMER.txt", DISCLAIMER, 1)

    if (MsgBox(FileRead(DISCLAIMER, "UTF-8") . "`n点击【是】代表同意上述免责声明`n点击【否】代表不同意上述免责声明", WINDOW_TITLE, 0x4 + 0x40) == "No") {
        ExitApp()
    }

    allowUpdate := false
    assetLocalVersion := 0
    assetsPath := ""
    select := false

    if (FileExist(ModAssetsDirectory . "\version.txt")) {
        try {
            assetLocalVersion := Number(FileRead(ModAssetsDirectory . "\version.txt"))
        } catch Error {
            assetLocalVersion := 0
        }
    }

    if (assetLocalVersion == 0) {
        select := true
        MsgBox("检测到 Pokemon TCG Live 中文化资源文件没有安装，请下载中文化资源包，然后点击【确定】选择资源包进行安装。", WINDOW_TITLE, 0x40)
    } else if (assetLocalVersion < ASSET_LATEST_VERSION && MsgBox("检测到 Pokemon TCG Live 中文化资源文件不是最新版，您可以选择下载最新的中文化资源包，然后点击【是】选择资源包进行更新，或者点击【否】不进行更新。", WINDOW_TITLE, 0x4 + 0x40) == "Yes") {
        allowUpdate := true
        select := true
    }

    if (select) {
        assetsPath := FileSelect(1, A_ScriptDir, "选择中文化资源文件", "资源文件 (*.assets.zip)")
        if (assetsPath == "" || !FileExist(assetsPath)) {
            InstallAbort("未选择中文化资源文件。")
        }
    }

    if ((!allowUpdate && InStr(assetsPath, "update.assets.zip")) || (allowUpdate && InStr(assetsPath, "update.assets.zip") && checkUpdateValid(assetLocalVersion))) {
        InstallAbort("请选择正确的中文化资源文件。")
    }

    try {
        InstallMain(assetsPath)
    } catch InstallError as e {
        UninstallMain(false)
        InstallAbort(e.Message)
    } catch Error as e {
        UninstallMain(false)
        InstallAbort("程序发生未知异常：" . e.Message . "`n`n" . e.Stack)
    }

    MsgBox("Pokemon TCG Live 中文化模组安装完成，您现在可以启动 Pokemon TCG Live 检查中文化模组是否有效。", WINDOW_TITLE, 0x40)
    ExitApp()
}

UninstallButton_Click(button, info) {
    global MainWindow
    MainWindow.Hide()

    if (MsgBox("你确定要卸载 Pokemon TCG Live 中文化模组吗？", WINDOW_TITLE, 0x1 + 0x20) == "Cancel") {
        ExitApp()
    }

    try {
        UninstallMain(MsgBox("您要删除 BepInEx 模组加载框架吗？", WINDOW_TITLE, 0x4 + 0x20) == "Yes")
    } catch UninstallError as e {
        UninstallAbort(e.Message)
    } catch Error as e {
        UninstallAbort("程序发生未知异常：" . e.Message . "`n`n" . e.Stack)
    }

    MsgBox("Pokemon TCG Live 中文化模组卸载完成", WINDOW_TITLE, 0x40)
    ExitApp()
}

DisableCheckbox_Click(checkbox, info) {
    DisabledMod := checkbox.Value

    if (DisabledMod && FileExist(PTCGLiveInstallDirectory . "\winhttp.dll")) {
        FileMove(PTCGLiveInstallDirectory . "\winhttp.dll", PTCGLiveInstallDirectory . "\winhttp.dll.bak", true)
        return
    }

    if (!DisabledMod && FileExist(PTCGLiveInstallDirectory . "\winhttp.dll.bak")) {
        FileMove(PTCGLiveInstallDirectory . "\winhttp.dll.bak", PTCGLiveInstallDirectory . "\winhttp.dll", true)
        return
    }

    DisabledMod := !DisabledMod
    checkbox.Value := DisabledMod ? 1 : 0

    MsgBox("出现错误，请尝试重新安装中文化模组。", WINDOW_TITLE, 0x10)
}

if (ProcessExist("Pokemon TCG Live.exe")) {
    MsgBox("检测到 Pokemon TCG Live 正在运行，请先关闭游戏再运行此程序。", WINDOW_TITLE, 0x30)
    ExitApp()
}

PTCGLiveInstallDirectory := GetPTCGLiveInstallDirectory()
ModDirectory := PTCGLiveInstallDirectory . "\BepInEx\plugins\ptcg-live-zh-mod"
ModAssetsDirectory := ModDirectory . "\assets"
ModDatabaseDirectory := ModDirectory . "\databases"
ModFontsDirectory := ModDirectory . "\fonts"
ModTextDirectory := ModDirectory . "\text"

if (PTCGLiveInstallDirectory == false) {
    MsgBox("未选择 Pokemon TCG Live 安装路径。", WINDOW_TITLE, 0x30)
    ExitApp()
}

if (!FileExist(PTCGLiveInstallDirectory . "\Pokemon TCG Live.exe")) {
    MsgBox("您选择的不是 Pokemon TCG Live 安装路径。", WINDOW_TITLE, 0x30)
    ExitApp()
}

tempDllPath := A_Temp . "\PTCGLiveZhMod.dll." . A_ScriptHwnd
FileInstall("bin\Release\netstandard2.0\PTCGLiveZhMod.dll", tempDllPath, 1)
modCurrentVersion := FileExist(ModDirectory . "\PTCGLiveZhMod.dll") ? FileGetVersion(ModDirectory . "\PTCGLiveZhMod.dll.") : "0.0.0.0"
modCurrentVersionNumber := Number(StrReplace(modCurrentVersion, ".", ""))
modNewVersion := FileGetVersion(tempDllPath)
modNewVersionNumber := Number(StrReplace(modNewVersion, ".", ""))
SafeFileDelete(tempDllPath)

MainWindow := Gui("-MinimizeBox", WINDOW_TITLE)
MainWindow.SetFont("s12", "Microsoft YaHei")

if (modCurrentVersionNumber != 0) {
    InstallButton := MainWindow.AddButton("w180 h40 x60 y40 Center", modNewVersionNumber > modCurrentVersionNumber ? "更新中文化模组" : "重新安装中文化模组")
    InstallButton.OnEvent("Click", InstallButton_Click)
    UninstallButton := MainWindow.AddButton("w180 h40 x60 y100 Center", "卸载中文化模组")
    UninstallButton.OnEvent("Click", UninstallButton_Click)
    DisableCheckbox := MainWindow.AddCheckbox("x100 y150 " . (FileExist(PTCGLiveInstallDirectory . "\winhttp.dll") ? "" : "Checked"), "临时禁用")
    DisableCheckbox.OnEvent("Click", DisableCheckbox_Click)
} else {
    InstallButton := MainWindow.AddButton("w180 h60 x60 y80 Center", "安装中文化模组")
    InstallButton.OnEvent("Click", InstallButton_Click)
}

MainWindow.SetFont("s10", "Microsoft YaHei")
MainWindow.AddText("x4 y220", modCurrentVersionNumber == 0 ? "" : ("已安装中文化模组版本：" . modCurrentVersion))
MainWindow.AddText("x4 y240", "中文化模组版本：" . modNewVersion)
MainWindow.AddText("x4 y260", "模组管理器版本：" . (A_IsCompiled ? FileGetVersion(A_ScriptFullPath) : "dev"))
MainWindow.AddLink("x180 y260", "<a href=`"https://github.com/Hill-98/ptcg-live-zh-mod`">开源仓库</a>")
MainWindow.AddLink("x240 y260", "<a href=`"https://url.mivm.cn/ptcg-live-zh-mod-download`">下载地址</a>")

MainWindow.Show("w300 h280 yCenter xCenter")
