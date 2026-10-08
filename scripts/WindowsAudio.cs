using System;
using System.Runtime.InteropServices;

namespace Sameera {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  internal class DeviceEnumerator { }
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int flow, uint mask, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IDevice device);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IDevice {
    [PreserveSig] int Activate(ref Guid id, uint context, IntPtr parameters, out IVolume volume);
  }
  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IVolume {
    [PreserveSig] int RegisterControlChangeNotify(IntPtr callback);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr callback);
    [PreserveSig] int GetChannelCount(out uint count);
    [PreserveSig] int SetMasterVolumeLevel(float level, ref Guid context);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
    [PreserveSig] int GetMasterVolumeLevel(out float level);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
  }
  public static class WindowsAudio {
    private static IVolume Endpoint() {
      IDevice device;
      Marshal.ThrowExceptionForHR(((IDeviceEnumerator)new DeviceEnumerator()).GetDefaultAudioEndpoint(0, 1, out device));
      IVolume volume;
      Guid id = typeof(IVolume).GUID;
      Marshal.ThrowExceptionForHR(device.Activate(ref id, 23, IntPtr.Zero, out volume));
      return volume;
    }
    public static float GetVolume() { float level; Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out level)); return level; }
    public static void SetVolume(float level) { Guid context = Guid.Empty; Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(level, ref context)); }
  }
}
