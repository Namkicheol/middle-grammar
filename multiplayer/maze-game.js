(function (global) {
  "use strict";
  const ICONS={"#":"",".":"","H":"🏠","T":"💎"};
  const DIRECTIONS={up:[0,-1,"↑"],down:[0,1,"↓"],left:[-1,0,"←"],right:[1,0,"→"]};
  let keyHandler=null;

  function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
  function tileAt(view,x,y){return view.layout?.[y]?.[x]}
  function canMove(view,direction){const delta=DIRECTIONS[direction];return !!delta&&Number(view.moveCredits)>0&&tileAt(view,Number(view.x)+delta[0],Number(view.y)+delta[1])!=="#"&&tileAt(view,Number(view.x)+delta[0],Number(view.y)+delta[1])!==undefined}

  function markup(view){
    const treasureSet=new Set(view.treasures||[]), rivals=new Map((view.rivals||[]).map(r=>[`${r.x},${r.y}`,r]));
    const cells=[];
    (view.layout||[]).forEach((row,y)=>[...row].forEach((source,x)=>{
      const self=x===Number(view.x)&&y===Number(view.y),rival=rivals.get(`${x},${y}`),home=x===Number(view.homeX)&&y===Number(view.homeY);
      const tile=treasureSet.has(`${x},${y}`)?"T":source==="T"?".":source, label=self?"내 위치":rival?`${rival.nickname} 위치`:home?"내 금고":tile==="#"?"벽":tile==="T"?"보물":"길";
      cells.push(`<div class="arena-cell tile-${tile==="#"?"wall":tile==="T"?"treasure":home?"home":"path"}${self?" is-me":""}${rival?" is-rival":""}" role="gridcell" aria-label="${esc(label)}">${self?'<span class="arena-player me">🧭</span>':rival?`<span class="arena-player rival" title="${esc(rival.nickname)}">🦊</span>`:`<span class="arena-icon">${ICONS[tile]||""}</span>`}</div>`);
    }));
    const controls=Object.entries(DIRECTIONS).map(([direction,data])=>`<button type="button" class="arena-move move-${direction}" data-action="maze-move" data-direction="${direction}" aria-label="${({up:"위로",down:"아래로",left:"왼쪽으로",right:"오른쪽으로"})[direction]}" ${canMove(view,direction)?"":"disabled"}>${data[2]}</button>`).join("");
    const carrying=Number(view.carriedLoot||0), banked=Number(view.bankedLoot||0);
    return `<section class="maze-arena" aria-labelledby="maze-arena-title">
      <header class="arena-head"><div><p>보물을 찾아 금고로!</p><h2 id="maze-arena-title">미궁 쟁탈전</h2></div><span class="arena-moves">👟 ${Number(view.moveCredits||0)}</span></header>
      <div class="arena-score"><span class="cargo${carrying?" hot":""}">🎒 들고 있음 <strong>${carrying}</strong><small>${carrying?"친구에게 빼앗길 수 있어요":"보물을 먼저 찾으세요"}</small></span><span>🏦 안전 금고 <strong>${banked}</strong><small>여기 넣으면 내 점수!</small></span><span>💎 남은 보물 <strong>${Number(view.remainingTreasures||0)}</strong><small>획득한 자리에는 8초 후 재등장</small></span></div>
      <div class="arena-layout"><div class="arena-board" role="grid" style="--maze-cols:${Number(view.width||13)}">${cells.join("")}</div><div class="arena-controls">${controls}</div></div>
      <p class="arena-rule">문제를 맞혀 이동권을 얻어요. 💎를 주워 🏠 내 금고로 돌아오면 점수가 됩니다. 가방의 보물은 같은 칸의 친구가 가져갈 수 있어요!</p>
    </section>`;
  }

  function mount(container,view,onMove){
    if(!container)return;container.innerHTML=markup(view);
    container.querySelectorAll("[data-maze-direction]").forEach(button=>button.addEventListener("click",()=>onMove(button.dataset.mazeDirection)));
    if(keyHandler)global.removeEventListener("keydown",keyHandler);
    keyHandler=event=>{if(event.target?.closest?.("input,textarea,select,[contenteditable=true]")||event.repeat)return;const direction={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right"}[event.key];if(direction&&canMove(view,direction)){event.preventDefault();onMove(direction)}};
    global.addEventListener("keydown",keyHandler);
  }

  function unmount(){if(keyHandler)global.removeEventListener("keydown",keyHandler);keyHandler=null}
  global.MazeArena={markup,mount,unmount,canMove};
})(window);
