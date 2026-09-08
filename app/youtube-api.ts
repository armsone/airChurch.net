export type YouTubePlayer = { loadVideoById:(videoId:string)=>void; playVideo:()=>void; mute:()=>void; unMute:()=>void; destroy:()=>void; getVideoData:()=>{video_id?:string} };
export type YouTubeEvent = { data?:number; target:YouTubePlayer };
type YouTubeApi = { Player:new(
  element:HTMLIFrameElement,
  options:{events:{onReady:(event:YouTubeEvent)=>void; onStateChange:(event:YouTubeEvent)=>void; onError:(event:YouTubeEvent)=>void}}
)=>YouTubePlayer };

let youtubeApiPromise:Promise<YouTubeApi>|null=null;
export function loadYouTubeApi() {
  if(youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise=new Promise<YouTubeApi>((resolve)=>{
    const browserWindow=window as Window&{YT?:YouTubeApi;onYouTubeIframeAPIReady?:()=>void};
    if(browserWindow.YT?.Player) { resolve(browserWindow.YT); return; }
    const previousReady=browserWindow.onYouTubeIframeAPIReady;
    browserWindow.onYouTubeIframeAPIReady=()=>{
      previousReady?.();
      if(browserWindow.YT?.Player) resolve(browserWindow.YT);
    };
    if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script=document.createElement("script");
      script.src="https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

