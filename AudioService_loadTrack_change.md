# One small edit in `src/services/AudioService.ts`

`App.tsx` now loads either the downloaded file or the recording into the
same player, so `loadTrack` needs an id and title.

**Find this function:**
```ts
export async function loadTrack(localPath: string) {
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: 'version-audio',
    url: localPath,
    title: 'Version Audio',
    artist: 'POC',
  });
}
```

**Replace it with:**
```ts
export async function loadTrack(
  localPath: string,
  id: string = 'version-audio',
  title: string = 'Version Audio'
) {
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id,
    url: localPath,
    title,
    artist: 'POC',
  });
}
```

Existing calls such as `loadTrack(localPath)` keep working because both
new parameters have defaults.

Make sure `getLocalFilePath` is exported from the same file (it already
is: `export function getLocalFilePath()`), and that the file imports
`expo-file-system/legacy` on SDK 57.
