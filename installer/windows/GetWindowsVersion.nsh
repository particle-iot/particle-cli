; GetWindowsVersion 4.1.1 (2015-06-22)
; http://nsis.sourceforge.net/Get_Windows_version
;
; Based on Yazno's function, http://yazno.tripod.com/powerpimpit/
; Update by Joost Verburg
; Update (Macro, Define, Windows 7 detection) - John T. Haller of PortableApps.com - 2008-01-07
; Update (Windows 8 detection) - Marek Mizanin (Zanir) - 2013-02-07
; Update (Windows 8.1 detection) - John T. Haller of PortableApps.com - 2014-04-04
; Update (Windows 10 TP detection) - John T. Haller of PortableApps.com - 2014-10-01
; Update (Windows 10 TP4 detection, and added include guards) - Kairu - 2015-06-22
;
; Usage: ${GetWindowsVersion} $R0
;
; $R0 contains: 95, 98, ME, NT x.x, 2000, XP, 2003, Vista, 7, 8, 8.1, 10.0 or '' (for unknown)
 
!ifndef __GET_WINDOWS_VERSION_NSH
!define __GET_WINDOWS_VERSION_NSH
 
!macro DefineGetWindowsVersion un
Function ${un}GetWindowsVersion
 
  Push $R0
  Push $R1
  Push $R2
  Push $R3
 
  ClearErrors
 
  ; check if Windows NT family
  ReadRegStr $R0 HKLM \
  "SOFTWARE\Microsoft\Windows NT\CurrentVersion" CurrentVersion
 
  IfErrors 0 lbl_winnt
 
  ; we are not NT
  ReadRegStr $R0 HKLM \
  "SOFTWARE\Microsoft\Windows\CurrentVersion" VersionNumber
 
  StrCpy $R1 $R0 1
  StrCmp $R1 '4' 0 lbl_error
 
  StrCpy $R1 $R0 3
 
  StrCmp $R1 '4.0' lbl_win32_95
  StrCmp $R1 '4.9' lbl_win32_ME lbl_win32_98
 
  lbl_win32_95:
    StrCpy $R0 '95'
  Goto lbl_done
 
  lbl_win32_98:
    StrCpy $R0 '98'
  Goto lbl_done
 
  lbl_win32_ME:
    StrCpy $R0 'ME'
  Goto lbl_done
 
  lbl_winnt:
 
  StrCpy $R1 $R0 1
 
  StrCmp $R1 '3' lbl_winnt_x
  StrCmp $R1 '4' lbl_winnt_x
 
  StrCpy $R1 $R0 3
 
  StrCmp $R1 '5.0' lbl_winnt_2000
  StrCmp $R1 '5.1' lbl_winnt_XP
  StrCmp $R1 '5.2' lbl_winnt_2003
  StrCmp $R1 '6.0' lbl_winnt_vista
  StrCmp $R1 '6.1' lbl_winnt_7
  StrCmp $R1 '6.2' lbl_winnt_8

  Goto lbl_winnt_latest
 
  lbl_winnt_x:
    StrCpy $R0 "NT $R0" 6
  Goto lbl_done
 
  lbl_winnt_2000:
    Strcpy $R0 '2000'
  Goto lbl_done
 
  lbl_winnt_XP:
    Strcpy $R0 'XP'
  Goto lbl_done
 
  lbl_winnt_2003:
    Strcpy $R0 '2003'
  Goto lbl_done
 
  lbl_winnt_vista:
    Strcpy $R0 'Vista'
  Goto lbl_done
 
  lbl_winnt_7:
    Strcpy $R0 '7'
  Goto lbl_done
 
  lbl_winnt_8:
    Strcpy $R0 '8'
  Goto lbl_done
 
  lbl_winnt_81:
    Strcpy $R0 '8.1'
  Goto lbl_done

  lbl_winnt_latest:
  ReadRegStr $R2 HKLM \
  "SOFTWARE\Microsoft\Windows NT\CurrentVersion" CurrentMajorVersionNumber
  ReadRegStr $R3 HKLM \
  "SOFTWARE\Microsoft\Windows NT\CurrentVersion" CurrentMinorVersionNumber
  StrCpy $R0 "$R2.$R3"
  StrCmp $R0 "" lbl_winnt_81
  Goto lbl_done

  lbl_error:
    Strcpy $R0 ''

  lbl_done:
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
 
FunctionEnd
!macroend
 
; Make GetWindowsVersion available for installer and uninstaller
!insertmacro DefineGetWindowsVersion ""
!insertmacro DefineGetWindowsVersion "un."

!macro GetWindowsVersion OUTPUT_VALUE
	!ifdef __UNINSTALL__
		Call un.GetWindowsVersion
	!else
		Call GetWindowsVersion
	!endif
	Pop `${OUTPUT_VALUE}`
!macroend
 
!define GetWindowsVersion '!insertmacro "GetWindowsVersion"'
 
!endif
