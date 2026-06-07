export interface StreamingLinks {
  spotify?: string;
  appleMusic?: string;
  youtubeMusic: string;
}

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  links: StreamingLinks;
  /** Unix ms when this song was recognized. */
  recognizedAt: number;
}
