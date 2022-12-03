/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

define(function (require, exports, module)
{
	"use strict";

	var ProjectManager = brackets.getModule("project/ProjectManager");
	var CommandManager = brackets.getModule("command/CommandManager");
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
	//var EditorManager = brackets.getModule("editor/EditorManager");
	var Menus = brackets.getModule("command/Menus");
	
	var SYMB_NL = "\n";
	
	var KS_EXCLUDE = "!";
	var KS_ESCAPE = "\\";

	var CMD_NEW_ID = "Productivity.ProjectFiles.StartSearching";
	var CMD_NEW_NAME = "Start Searching in Project Files";
	var CMD_NEW_KEY = "Alt-s";

	var CMD_CONTINUE_ID = "Productivity.ProjectFiles.ContinueSearching";
	var CMD_CONTINUE_NAME = "Continue Searching in Project Files";
	var CMD_CONTINUE_KEY = "Alt-c";
	
	var CMD_CLEAN_ID = "Productivity.ProjectFiles.CleanSearchQuery";
	var CMD_CLEAN_NAME = "Clean Project Files Search Query";
	var CMD_CLEAN_KEY = "Alt-x";

	var PROJECT_FILES_HEADER_ID = "project-files-header";

	var BAR_ID = "productivity-project-files-search-bar";
	var BAR_EL = "input#productivity-project-files-search-bar";
	var BAR_TXT = "Alt + S/C/X to start/continue/clean";
	var BAR_FOCUSED_TXT = "Separate by space, ESC to clean, ! - exclude, / - dir sep, \\ - esc";
	var BAR_TITLE = BAR_TXT + SYMB_NL + BAR_FOCUSED_TXT
	
	var SEARCH_TIMEOUT = 250;

	var FILETREE_ROOT_EL = "ul.jstree-brackets";
	var FILETREE_DIR_OPENED_CLASS = "jstree-open";
	var FILETREE_DIR_OPENED_EL = "ul.jstree-brackets li.jstree-open";
	var FILETREE_DIR_CLOSED_CLASS = "jstree-closed";
	var FILETREE_DIR_CLOSED_EL = "ul.jstree-brackets li.jstree-closed";
	var FILETREE_FILE_CLASS = "jstree-leaf";
	var FILETREE_FILE_EL = "ul.jstree-brackets li.jstree-leaf";
	var FILETREE_FILE_LOCAL_EL = "li.jstree-leaf";
	var FILETREE_FILE_LOCAL_EXCLUDED_EL = "li.jstree-leaf.search-exclude";
	var FILETREE_EXCLUDED_El = "ul.jstree-brackets li.search-exclude";
	var FILETREE_ANY_El = "ul.jstree-brackets li";
	var FILETREE_SELECTION_EL = "div.filetree-selection";
	var FILETREE_SELECTION_EXTENSION_EL = "div.filetree-selection-extension";
	var FILETREE_DATA_SEARCH_ATTR = "data-search";

	var KEY_ESC = 27;
	
	var EL_EXCLUDE = "search-exclude";

	var searchTimeout = null;
	
	var util = {};
	
	util.str = new function ()
	{
		this.toArrSplitBySpaceLc = function (str)
		{
			return str.toLowerCase().split(" ").filter(Boolean);
		}
		
		this.contains = function (str, what)
		{
			return str.indexOf(what) < 0 ?  false : true;
		}
		
		this.hasFirstChar = function (str, char)
		{
			return str.charAt(0) === char ? true : false;
		}
		
		this.replace = function (str, ch1, ch2)
		{
			return str.replace(ch1, ch2);
		}
		
		this.escape = function (str)
		{
			return str.replace(KS_ESCAPE, '');
		}
		
		this.delFirstChar = function (str)
		{
			return str.substring(1);
		}
	}
	
	util.searcher = new function ()
	{
		function isValidStrWithNode (str, node)
		{
			if (util.str.contains(str, node.str)) return node.exclude ? false : true;
		}
		
		function formatNode (node)
		{
			if (util.str.hasFirstChar(node, KS_EXCLUDE)) {
				return {
					str : util.str.escape(util.str.delFirstChar(node)),
					exclude : true
				}
			} else {
				return {
					str : util.str.escape(node),
					exclude : false
				}
			}
		}
		
		this.isValidStrWithNodes = function (str, nodes)
		{
			for (let node of nodes) if (!isValidStrWithNode(str, node)) return false;

			return true;
		}
		
		this.buildNodes = function (str)
		{
			return util.str.toArrSplitBySpaceLc(str).map((v) => formatNode(v));
		}
	};

	start();

	function start()
	{
		loadStyles()

		registerMenuCommands();
		registerMenuItems();

		createSearchBar();
		
		listenProjectManager();
	}
	
	function loadStyles ()
	{
		ExtensionUtils.loadStyleSheet(module, "style.css");
	}
	
	function listenProjectManager ()
	{
		ProjectManager.on("projectOpen", cleanSearchInput);
	}
	
	function cleanSearchInput ()
	{
		$(BAR_EL).val("");

		startSearchTimeout();
	}
	
	function fileTreeSelectionHide ()
	{
		$(FILETREE_SELECTION_EL).css("display", "none");
		$(FILETREE_SELECTION_EXTENSION_EL).css("display", "none");
	}
	
	function createSearchBar ()
	{
		var projectFilesHeader = document.getElementById(PROJECT_FILES_HEADER_ID);

		var searchBar = document.createElement("input");
		searchBar.type = "text";
		searchBar.title = BAR_TITLE;
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
	}
	
	function searchProjectFiles ()
	{
		var search = $(BAR_EL).val();
		//alert('search: "'+search+'"');
		fileTreeSelectionHide();

		if (search.length > 0) {
			fileTreeConfigure(FILETREE_ROOT_EL);
			fileTreeSearch(search);
			fileTreeDirs();
		} else {
			fileTreeConfigure(FILETREE_ROOT_EL);
			fileTreeOpenAll();
		}
	}
	
	function fileTreeOpenAll ()
	{
		$(FILETREE_EXCLUDED_El).each((i, e) => $(e).removeClass(EL_EXCLUDE));
	}
	
	function fileTreeDirs ()
	{
		$(FILETREE_DIR_OPENED_EL).each(function(i, e){
			var dir = $(e);

			if(dir.find(FILETREE_FILE_LOCAL_EL).length === dir.find(FILETREE_FILE_LOCAL_EXCLUDED_EL).length) dir.addClass(EL_EXCLUDE);
			else dir.removeClass(EL_EXCLUDE);
		})
	}
	
	function fileTreeSearch(search)
	{
		var nodes = util.searcher.buildNodes(search);

		$(FILETREE_FILE_EL).each(
			function (i, e)
			{
				if (util.searcher.isValidStrWithNodes($(e).attr(FILETREE_DATA_SEARCH_ATTR), nodes)) $(e).removeClass(EL_EXCLUDE);
				else $(e).addClass(EL_EXCLUDE);
			}
		);
	}
	
	function fileTreeTagGet (e)
	{
		var o='';

		$(e).children("a").first().children("span").each((i, e)=>{ o+=$(e).text() });

		return o;
	}
	
	function fileTreeTagClean (...i)
	{
		var o = [];

		for( let e of i) if(e) o.push(e.toLowerCase());

		return o.join('/');
	}
	
	function fileTreeConfigure (i, tags)
	{
		$(i).children("li").each(
			function (i,e)
			{
				if ($(e).hasClass(FILETREE_DIR_CLOSED_CLASS)) {
					$(e).click();//.attr("data-closed",true);

					fileTreeConfigure($(e).children("ul").first(), fileTreeTagClean(tags, fileTreeTagGet(e)));
				} else if ($(e).hasClass(FILETREE_DIR_OPENED_CLASS)) {
					fileTreeConfigure($(e).children("ul").first(), fileTreeTagClean(tags, fileTreeTagGet(e)));
				} else if ($(e).hasClass(FILETREE_FILE_CLASS)) {
					$(e).attr(FILETREE_DATA_SEARCH_ATTR, fileTreeTagClean(tags, fileTreeTagGet(e)));
				} else $(e).removeAttr(FILETREE_DATA_SEARCH_ATTR);
			}
		);
	}
	
	function onSearchBarKeyUp (e)
	{
		if(e.keyCode === KEY_ESC) cleanSearchInput();
		else startSearchTimeout();
	}
	
	function startSearchTimeout ()
	{
		clearTimeout(searchTimeout);
		
		searchTimeout = setTimeout(searchProjectFiles, SEARCH_TIMEOUT);
	}
	
	//// Commands
	
	function commandStartSearching ()
	{
		var input = $(BAR_EL).focus();

		input = input[0];
		input.setSelectionRange(0, input.value.length);
	}
	function commandContinueSearching () {
		var val = $(BAR_EL).val();

		var e = $(BAR_EL).focus();
		
		e.val(val);
	}
	
	//// Menu
	
	function registerMenuCommands ()
	{
		CommandManager.register(CMD_NEW_NAME, CMD_NEW_ID, commandStartSearching);
		CommandManager.register(CMD_CONTINUE_NAME, CMD_CONTINUE_ID, commandContinueSearching);
		CommandManager.register(CMD_CLEAN_NAME, CMD_CLEAN_ID, cleanSearchInput);
	}
	
	function registerMenuItems ()
	{
		var menu = Menus.getMenu(Menus.AppMenuBar.FIND_MENU);

		menu.addMenuDivider();

		menu.addMenuItem(CMD_NEW_ID, [{key:CMD_NEW_KEY}]);
		menu.addMenuItem(CMD_CONTINUE_ID, [{key:CMD_CONTINUE_KEY}]);
		menu.addMenuItem(CMD_CLEAN_ID, [{key:CMD_CLEAN_KEY}]);
	}
});