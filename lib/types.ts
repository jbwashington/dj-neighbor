export interface StreamingLinks {
  spotify?: string;
  appleMusic?: string;
  youtubeMusic: string;
}

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  released?: string;
  label?: string;
  genre?: string;
  artwork?: string;
  links: StreamingLinks;
  /** Unix ms when this song was recognized. */
  recognizedAt: number;
}
