/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

// Re-indent the open document according to your current indentation settings.
define(function(require, exports, module){
    "use strict";

   // var ProjectManager = brackets.getModule("project/ProjectManager");
    var CommandManager = brackets.getModule("command/CommandManager");
    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    //var EditorManager = brackets.getModule("editor/EditorManager");
    var Menus = brackets.getModule("command/Menus");

    var CMD_ID = "Productivity.ProjectFiles.Search";
    var CMD_NAME = "Search in Project Files";
    var CMD_KEY = "Alt-s";
    
    var PROJECT_FILES_HEADER_ID = "project-files-header";

    var BAR_ID = "productivity-project-files-search-bar";
    var BAR_EL = "input#productivity-project-files-search-bar";
    var BAR_TXT = "Alt + S to start searching";
    var BAR_FOCUSED_TXT = " type or Esc to clean, separate by space";
    var BAR_TIMEOUT = 250;
    
    var JSTREE_ROOT_EL = "ul.jstree-brackets";
    var JSTREE_DIR_OPENED_CLASS = "jstree-open";
    var JSTREE_DIR_OPENED_EL= "ul.jstree-brackets li.jstree-open";
    var JSTREE_DIR_CLOSED_CLASS = "jstree-closed";
    var JSTREE_DIR_CLOSED_EL = "ul.jstree-brackets li.jstree-closed";
    var JSTREE_FILE_CLASS = "jstree-leaf";
    var JSTREE_FILE_EL = "ul.jstree-brackets li.jstree-leaf";
    var JSTREE_FILE_LOCAL_EL = "li.jstree-leaf";
    var JSTREE_FILE_LOCAL_HIDDEN_EL = "li.jstree-leaf.hidden";
    var JSTREE_HIDDEN_El = "ul.jstree-brackets li.hidden";
    
    var FILETREE_SELECTION_EL = "div.filetree-selection";
    var FILETREE_SELECTION_EXTENSION_EL = "div.filetree-selection-extension";
    
    var searchBarTimeout = null;

    start();

    function start(){
        ExtensionUtils.loadStyleSheet(module, "style.css");
        
        menuCommandRegister();
        createSearchBar();
    }
    function searchBarClean(){
        $(BAR_EL).val("");
    }
    function filetreeSelectionHide(){
        $(FILETREE_SELECTION_EL).css("display", "none");
        $(FILETREE_SELECTION_EXTENSION_EL).css("display", "none");
    }
    function createSearchBar(){
        var projectFilesHeader = document.getElementById(PROJECT_FILES_HEADER_ID);

        var searchBar = document.createElement("input");
        searchBar.type = "text";
        searchBar.setAttribute("placeholder", BAR_TXT);
        searchBar.id = BAR_ID;
        searchBar.addEventListener("keyup", onSearchBarKeyUp);

        projectFilesHeader.appendChild(searchBar);

        $(BAR_EL)
            .on("blur", function(){
                $(this).attr("placeholder", BAR_TXT);
            })
            .on("focus", function(){
                $(this).attr("placeholder", BAR_FOCUSED_TXT);
            });
    };
    function searchProjectFiles(){
        var search=$(BAR_EL).val();
        
        filetreeSelectionHide();

        if(search.length>0){
            jstreeConfigure(JSTREE_ROOT_EL);
            jstreeSearch(jstreeSearchPrepare(search));
            jstreeDirs();
        }else jstreeOpenAll();
    }
    function jstreeOpenAll(){
        $(JSTREE_HIDDEN_El).each((i, e) => $(e).removeClass("hidden"));
    }
    function jstreeDirs(){
        $(JSTREE_DIR_OPENED_EL).each(function(i, e){
            var dir = $(e);

            if(dir.find(JSTREE_FILE_LOCAL_EL).length === dir.find(JSTREE_FILE_LOCAL_HIDDEN_EL).length) dir.addClass("hidden");
            else dir.removeClass("hidden");
        })
    }
    function jstreeSearchPrepare(i){
        return i.toLowerCase().split(" ").filter(Boolean);
    }
    function jstreeSearchContain(str, search){
        for(let e of search) if(str.indexOf(e) < 0) return false;

        return true;
    }
    function jstreeSearch(search){
        $(JSTREE_FILE_EL).each(function(i, e){
            if(jstreeSearchContain($(e).attr("data-search"), search)) $(e).removeClass("hidden");
            else $(e).addClass("hidden");
        });
    }
    function jstreeTagGet(e){
        var o='';

        $(e).children("a").first().children("span").each((i, e)=>{ o+=$(e).text()})
        
        return o;
    }
    function jstreeTagClean(...i){
        var o='';
        
        for( let e of i) if(e) o+=e.toLowerCase();
        
        return o;
    }
    function jstreeConfigure(i, tags){
        $(i).children("li").each(function(i,e){
            if($(e).hasClass(JSTREE_DIR_CLOSED_CLASS)){
                $(e).click();//.attr("data-closed",true);
                
                jstreeConfigure($(e).children("ul").first(), jstreeTagClean(tags, jstreeTagGet(e)));
            }else if($(e).hasClass(JSTREE_DIR_OPENED_CLASS)){
                jstreeConfigure($(e).children("ul").first(), jstreeTagClean(tags, jstreeTagGet(e)));
            }else if($(e).hasClass(JSTREE_FILE_CLASS)){
                $(e).attr("data-search", jstreeTagClean(tags, jstreeTagGet(e)));
            }
        });
    }
    function onSearchBarKeyUp(e){
        if(e.keyCode===27) searchBarClean();
            
        clearTimeout(searchBarTimeout);
        searchBarTimeout = setTimeout(searchProjectFiles, BAR_TIMEOUT);
    }
    function focusOnSearchBar(){
        var input = $(BAR_EL).focus();
        
        input = input[0];
        input.setSelectionRange(0, input.value.length);
    }
    function menuCommandRegister(){
        CommandManager.register(CMD_NAME, CMD_ID, focusOnSearchBar);

        var menu = Menus.getMenu(Menus.AppMenuBar.FIND_MENU);
        menu.addMenuItem(CMD_ID, [{key:CMD_KEY}]);
    }
});