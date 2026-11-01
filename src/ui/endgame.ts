/** Native dialog supplies focus containment and Escape handling. Dismissal
 * persists through inspection refreshes until another game is loaded. */
export function endgameModal(dialog:HTMLDialogElement,title:HTMLElement,detail:HTMLElement,inspect:HTMLButtonElement,map:HTMLElement){
  let announced=false;
  dialog.addEventListener('close',()=>{if(!dialog.open)map.focus({preventScroll:true});});
  inspect.addEventListener('click',()=>dialog.close());
  return {
    reset(){announced=false;if(dialog.open)dialog.close();},
    show(){if(!dialog.open){dialog.showModal();inspect.focus();}},
    update(finished:boolean,heading:string,description:string){
      title.textContent=heading;detail.textContent=description;
      if(!finished){announced=false;if(dialog.open)dialog.close();return;}
      if(!announced){announced=true;this.show();}
    }
  };
}
