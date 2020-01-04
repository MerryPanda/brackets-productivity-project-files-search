/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

// Re-indent the open document according to your current indentation settings.
define(function (require, exports, module) {
	"use strict";

	var ProjectManager = brackets.getModule("project/ProjectManager");
	var CommandManager = brackets.getModule("command/CommandManager");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	//var EditorManager = brackets.getModule("editor/EditorManager");
	var Menus = brackets.getModule("command/Menus");

	var CMD_NEW_ID = "Productivity.ProjectFiles.StartSearching";
	var CMD_NEW_NAME = "Start Searching in Project Files";
	var CMD_NEW_KEY = "Alt-s";

	var CMD_CONTINUE_ID = "Productivity.ProjectFiles.ContinueSearching";
	var CMD_CONTINUE_NAME = "Continue Searching in Project Files";
	var CMD_CONTINUE_KEY = "Alt-c";
	
	var CMD_CLEAN_ID = "Productivity.ProjectFiles.CleanSearch Query";
	var CMD_CLEAN_NAME = "Clean Project Files Search Query";
	var CMD_CLEAN_KEY = "Alt-x";

	var PROJECT_FILES_HEADER_ID = "project-files-header";

	var BAR_ID = "productivity-project-files-search-bar";
	var BAR_EL = "input#productivity-project-files-search-bar";
	var BAR_TXT = "Alt + S/C/X to start/continue/clean";
	var BAR_FOCUSED_TXT = "separate by space, Esc to clean";
	
	var SEARCH_TIMEOUT = 250;

	var JSTREE_ROOT_EL = "ul.jstree-brackets";
	var JSTREE_DIR_OPENED_CLASS = "jstree-open";
	var JSTREE_DIR_OPENED_EL= "ul.jstree-brackets li.jstree-open";
	var JSTREE_DIR_CLOSED_CLASS = "jstree-closed";
	var JSTREE_DIR_CLOSED_EL = "ul.jstree-brackets li.jstree-closed";
	var JSTREE_FILE_CLASS = "jstree-leaf";
	var JSTREE_FILE_EL = "ul.jstree-brackets li.jstree-leaf";
	var JSTREE_FILE_LOCAL_EL = "li.jstree-leaf";
	var JSTREE_FILE_LOCAL_EXCLUDED_EL = "li.jstree-leaf.search-exclude";
	var JSTREE_EXCLUDED_El = "ul.jstree-brackets li.search-exclude";
	var JSTREE_ANY_El = "ul.jstree-brackets li";

	var FILETREE_SELECTION_EL = "div.filetree-selection";
	var FILETREE_SELECTION_EXTENSION_EL = "div.filetree-selection-extension";

	var KEY_ESC = 27;
	
	var EL_EXCLUDE = "search-exclude";

	var searchTimeout = null;

	start();

	function start(){
		loadStyles()

		registerMenuCommands();
		registerMenuItems();

		createSearchBar();
		
		listenProjectManager();
	}
	function loadStyles () {
		ExtensionUtils.loadStyleSheet(module, "style.css");
	}
	function listenProjectManager () {
		ProjectManager.on("projectOpen", cleanSearchInput);
	}
	function cleanSearchInput () {
		$(BAR_EL).val("");

		startSearchTimeout();
	}
	function filetreeSelectionHide () {
		$(FILETREE_SELECTION_EL).css("display", "none");
		$(FILETREE_SELECTION_EXTENSION_EL).css("display", "none");
	}
	function createSearchBar () {
		var projectFilesHeader = document.getElementById(PROJECT_FILES_HEADER_ID);

		var searchBar = document.createElement("input");
		searchBar.type = "text";
		searchBar.setAttribute("placeholder", BAR_TXT);
		searchBar.id = BAR_ID;
		searchBar.addEventListener("keyup", onSearchBarKeyUp);

		projectFilesHeader.appendChild(searchBar);

		$(BAR_EL)
			.on("blur", function () {
				$(this).attr("placeholder", BAR_TXT);
			})
			.on("focus", function () {
				$(this).attr("placeholder", BAR_FOCUSED_TXT);
			});
	};
	function searchProjectFiles () {
		var search = $(BAR_EL).val();
		//alert('search: "'+search+'"');
		filetreeSelectionHide();

		if (search.length > 0) {
			jstreeConfigure(JSTREE_ROOT_EL);
			jstreeSearch(jstreeSearchPrepare(search));
			jstreeDirs();
		} else {
			jstreeConfigure(JSTREE_ROOT_EL);
			jstreeOpenAll();
		}
	}
	function jstreeOpenAll () {
		$(JSTREE_EXCLUDED_El).each((i, e) => $(e).removeClass(EL_EXCLUDE));
	}
	function jstreeDirs () {
		$(JSTREE_DIR_OPENED_EL).each(function(i, e){
			var dir = $(e);

			if(dir.find(JSTREE_FILE_LOCAL_EL).length === dir.find(JSTREE_FILE_LOCAL_EXCLUDED_EL).length) dir.addClass(EL_EXCLUDE);
			else dir.removeClass(EL_EXCLUDE);
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
		$(JSTREE_FILE_EL).each(function (i, e) {
			if(jstreeSearchContain($(e).attr("data-search"), search)) $(e).removeClass(EL_EXCLUDE);
			else $(e).addClass(EL_EXCLUDE);
		});
	}
	function jstreeTagGet (e) {
		var o='';

		$(e).children("a").first().children("span").each((i, e)=>{ o+=$(e).text() })

		return o;
	}
	function jstreeTagClean (...i) {
		var o = [];

		for( let e of i) if(e) o.push(e.toLowerCase());

		return o.join('/');
	}
	function jstreeConfigure (i, tags) {
		$(i).children("li").each(function (i,e) {
			if ($(e).hasClass(JSTREE_DIR_CLOSED_CLASS)) {
				$(e).click();//.attr("data-closed",true);

				jstreeConfigure($(e).children("ul").first(), jstreeTagClean(tags, jstreeTagGet(e)));
			} else if ($(e).hasClass(JSTREE_DIR_OPENED_CLASS)) {
				jstreeConfigure($(e).children("ul").first(), jstreeTagClean(tags, jstreeTagGet(e)));
			} else if ($(e).hasClass(JSTREE_FILE_CLASS)) {
				$(e).attr("data-search", jstreeTagClean(tags, jstreeTagGet(e)));
			} else $(e).removeAttr("data-search");
		});
	}
	function onSearchBarKeyUp (e) {
		if(e.keyCode === KEY_ESC) cleanSearchInput();
		else startSearchTimeout();
	}
	function startSearchTimeout () {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(searchProjectFiles, SEARCH_TIMEOUT);
	}
	////// COMMANDS
	function commandStartSearching () {
		var input = $(BAR_EL).focus();

		input = input[0];
		input.setSelectionRange(0, input.value.length);
	}
	function commandContinueSearching () {
		var val = $(BAR_EL).val();

		var e = $(BAR_EL).focus();
		
		e.val(val);
	}
	////// MENU
	function registerMenuCommands () {
		CommandManager.register(CMD_NEW_NAME, CMD_NEW_ID, commandStartSearching);
		CommandManager.register(CMD_CONTINUE_NAME, CMD_CONTINUE_ID, commandContinueSearching);
		CommandManager.register(CMD_CLEAN_NAME, CMD_CLEAN_ID, cleanSearchInput);
	}
	function registerMenuItems () {
		var menu = Menus.getMenu(Menus.AppMenuBar.FIND_MENU);

		menu.addMenuDivider();

		menu.addMenuItem(CMD_NEW_ID, [{key:CMD_NEW_KEY}]);
		menu.addMenuItem(CMD_CONTINUE_ID, [{key:CMD_CONTINUE_KEY}]);
		menu.addMenuItem(CMD_CLEAN_ID, [{key:CMD_CLEAN_KEY}]);
	}
});