!macro customInstall
  ; Register mdPad as a candidate in Windows Default Apps.
  WriteRegStr SHELL_CONTEXT "Software\mdPad\Capabilities" "ApplicationName" "mdPad"
  WriteRegStr SHELL_CONTEXT "Software\mdPad\Capabilities" "ApplicationDescription" "A clear, private desktop editor and viewer for Markdown documents."
  WriteRegStr SHELL_CONTEXT "Software\mdPad\Capabilities" "ApplicationIcon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\mdPad\Capabilities\FileAssociations" ".md" "mdPad.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\mdPad\Capabilities\FileAssociations" ".markdown" "mdPad.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "mdPad" "Software\mdPad\Capabilities"

  ; Register the executable explicitly for Explorer's Open with list.
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "mdPad"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\DefaultIcon" "" "$appExe,0"
  WriteRegNone SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".md"
  WriteRegNone SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".markdown"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" "$\"$appExe$\" $\"%1$\""
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "mdPad"
  DeleteRegKey SHELL_CONTEXT "Software\mdPad\Capabilities"
  DeleteRegKey /ifempty SHELL_CONTEXT "Software\mdPad"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
!macroend
