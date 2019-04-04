(function ($) {
    "use strict";
    $.fn.treegridData = function (options, param) {

        //如果是调用方法
        if (typeof options == 'string') {
            return $.fn.treegridData.methods[options](this, param);
        }

        //如果是初始化组件
        options = $.extend({}, $.fn.treegridData.defaults, options || {});
        var target = $(this);
        //得到根节点
        target.getRootNodes = function (data) {
            var result = [];
            for (var i = data.length; i--;) {
                if (isVarEmpty(data[i][options.parentColumn])) {
                    result.push(data[i]);
                }
            }
            return result;
        };

        target.options = options;

        var j = 0;
        //分组map
        var groupbyMap = new Map();

        //设置请求参数
        target.setAjaxData = function (data) {
            options.ajaxParams = data;
            return target;
        };

        //获取数据
        target.getData = function () {
            return options.data;
        };
        /**
         * 删除
         */
        target.remove = function () {
            target.empty();
        }

        /**
         * 清空表体
         */
        target.removeTbody = function () {
            target.find("tbody").empty();
        }

        /**
         * 初始化表头
         * @returns {*|HTMLElement}
         */
        target.initHeader = function () {
            var thead = null;
            if (options.thead == undefined || options.thead == "undefined" || options.thead == "" || options.thead == null) {
                //构造表头
                var thr = $('<tr></tr>');
                for (var i = 0; i < options.columns.length; i++) {
                    var th = $('<th style="padding:10px;text-align: center;"></th>');
                    th.text(options.columns[i].title);
                    thr.append(th);
                }
                thead = $('<thead></thead>');
                thead.append(thr);
            } else {
                thead = $(options.thead);
            }
            return thead;

        }

        target.initBody = function (data) {
            var _thead, _value = "", style = {};
            _thead = target.initHeader();
            target.append(_thead);
            //构造表体
            var tbody = $('<tbody></tbody>');
            if (data.length > 0) {
                var rootNode = target.getRootNodes(data);
                for (var i = 0; i < rootNode.length; i++) {
                    var item = rootNode[i];
                    var tr = $('<tr></tr>');
                    //处理行样式
                    style = calculateObjectValue(options, options.rowStyle, [item, i], style);
                    tr.css(style);
                    tr.addClass('treegrid-' + (j + i));
                    tr.attr('row-id', item[options.idField]);
                    for (var z = 0; z < options.columns.length; z++) {
                        var td = $('<td></td>'), column = options.columns[z];
                        if (typeof column.field !== 'undefined')
                            _value = item[column.field] == null ? "" : item[column.field];
                        //处理可编辑列
                        if (typeof column.formatter !== 'undefined') {
                            _value = calculateObjectValue(column, column.formatter, [_value, item, i], _value)
                        }
                        if (typeof column.editable !== 'undefined') {
                            tr.attr('data-id', item[options.idField]);
                            _value = calculateEditable(_value, column, item);
                        }
                        if (typeof column.width !== 'undefined') {
                            td.attr('width', column.width)
                        }
                        if (typeof column.class !== 'undefined') {
                            td.addClass(column.class)
                        }
                        td.html(_value);
                        tr.append(td);
                    }
                    tbody.append(tr);
                    var level = 1;
                    target.getChildNodes(data, item, (j + i), tbody, level);
                }
                target.append(tbody);
                target.initEvent();
                target.treegrid({
                    expanderExpandedClass: options.expanderExpandedClass,
                    expanderCollapsedClass: options.expanderCollapsedClass
                });

            }
        }


        target.noDataShow = function () {

            var tbody = $('<tbody></tbody>');
            //未找到数据展示
            var tr = $('<tr></tr>');
            var z = 0;
            $.each(options.columns, function (index, column) {
                z += 1;
            });
            var td = $('<td></td>');
            td.attr("colspan", z);
            td.css({"text-align": "center"});
            td.html("无法找到数据");
            tr.append(td);
            tbody.append(tr);
            //初始化表头并加载到表格中
            target.append(target.initHeader());
            target.append(tbody);
        }
        //事件执行
        target.trigger = function (self, name, arg) {
            options[name].apply(self, arg || []);
            self.trigger($.Event(name), arg || []);
        }

        //初始化事件
        target.initEvent = function () {
            var that = this;
            //绑定选中行变色
            that.find('tr').on('click', function () {
                $(this).addClass('action').css("background-color", "#e2f5ff")     //为选中项添加高亮
                    .siblings().removeClass('action').css("background-color", 'white')//去除其他项的高亮形式
                    .end();
            });

            //初始化编辑事件
            if (!options.editable) {
                return;
            }
            //设置data-pk值
            that.find("tr").each(function (index, item) {
                var id = $(item).attr("data-id");
                $(item).find("td").find('a').each(function (_index, _item) {
                    var name = $(_item).attr("data-name");
                    $(_item).attr("data-pk", name + id);
                });
            });

            $.each(options.columns, function (i, column) {
                that.find('a[data-name="' + column.field + '"]').editable(column.editable)
                    .off('save').on('save', function (e, params) {
                    var data = that.getData(),
                        idField = $(this).parents('tr[data-id]').data('id'),
                        row;
                    for (var i = 0; i < data.length; i++) {
                        if (idField == data[i][options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    var oldValue = row[column.field];
                    row[column.field] = params.submitValue;
                    that.trigger($(this), 'onEditableSave', [column.field, row, oldValue, $(this)]);
                });
                that.find('a[data-name="' + column.field + '"]').editable(column.editable)
                    .off('shown').on('shown', function (e, editable) {
                    var data = that.getData(),
                        idField = $(this).parents('tr[data-id]').data('id'),
                        row;
                    for (var i = 0; i < data.length; i++) {
                        if (idField == data[i][options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    that.trigger($(this), 'onEditableShown', [column.field, row, $(this)]);
                    // options.onEditableShown.apply(column.field, row, $(this));
                    // that.trigger($.Event("onEditableShown"), column.field, row, $(this));
                });
                that.find('a[data-name="' + column.field + '"]').editable(column.editable)
                    .off('hidden').on('hidden', function (e, reason) {
                    var data = that.getData(),
                        idField = $(this).parents('tr[data-id]').data('id'),
                        row;
                    for (var i = 0; i < data.length; i++) {
                        if (idField == data[i][options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    that.trigger($(this), 'onEditableHidden', [column.field, row, $(this)]);
                    // options.onEditableHidden.apply(column.field, row, $(this));
                    // that.trigger($.Event("onEditableHidden"), column.field, row, $(this));
                });

            });
            that.trigger($(this), 'onEditableInit');
            // this.trigger('onEditableInit');
        };

        /**
         * 重新加载
         */
        target.reload = function () {
            if (options.thead === null) {
                //清空表
                target.empty();
            } else {
                //清空表体
                target.find("tbody").empty();
            }
            $.ajax({
                type: options.type,
                url: options.url,
                data: options.ajaxParams,
                cache: false,
                dataType: "JSON",
                success: function (data, textStatus, jqXHR) {
                    if (data.length > 0) {
                        options.data = data;
                        layer.load(1, {
                            shade: [0.3, '#fff'] //0.1透明度的白色背景
                        });
                        target.initBody(data);
                    } else {
                        target.noDataShow();
                    }
                    if (!options.expandAll) {
                        target.treegrid('collapseAll');
                    }
                },
                beforeSend: function () {
                    layer.load(1, {
                        shade: [0.3, '#fff'] //0.1透明度的白色背景
                    });
                },
                complete: function () {
                    layer.closeAll('loading');
                }
            });

        };

        /**
         * 数组加载（未清除表头）
         */
        target.loadData = function (data) {

            if (options.thead === null) {
                //清空表
                target.empty();
            } else {
                //清空表体
                target.find("tbody").empty();
            }
            if (Array.isArray(data)) {
                options.data = data;
                layer.load(1, {
                    shade: [0.3, '#fff'] //0.1透明度的白色背景
                });
                target.initBody(data);
                layer.closeAll('loading');
            } else {
                layer.load(1, {
                    shade: [0.3, '#fff'] //0.1透明度的白色背景
                });
                target.noDataShow();
                layer.closeAll('loading');
            }

        };

        /**
         * 递归获取子节点并且设置子节点
         * @param data 数据
         * @param parentNode 父节点
         * @param parentIndex 父类索引
         * @param tbody  表格对象
         * @param level 层级
         */
        target.getChildNodes = function (data, parentNode, parentIndex, tbody, level) {
            var indent = options.indent, style = {};
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                if (item[options.parentColumn] == parentNode[options.id]) {
                    var tr = $('<tr></tr>');
                    var nowParentIndex = (parentIndex + "" + (j++));
                    var newlevel = level + 1;
                    tr.addClass('treegrid-' + nowParentIndex);
                    tr.addClass('treegrid-parent-' + parentIndex);
                    //处理行样式
                    style = calculateObjectValue(options, options.rowStyle, [item, i], style);
                    tr.css(style);
                    tr.attr('row-id', item[options.idField]);
                    $.each(options.columns, function (index, column) {
                        var td = $('<td></td>');
                        var cssValue = level * indent;
                        var css = {"padding-left": cssValue + "px"};
                        var _value = "";
                        if (index == 0) {
                            td.css(css)
                        }
                        if (typeof column.field !== 'undefined')
                            _value = item[column.field] == null ? "" : item[column.field];
                        //合并分组
                        if (typeof column.groupBy !== 'undefined' && column.groupBy) {
                            //判断是否分组过 判断依据  分组名+本身属性+父类关联
                            if (!groupbyMap.hasKey(item[column.groupByField] + column.field + item[options.parentColumn])) {
                                _value = calculateGroupby(column, column.groupByField, options.parentColumn, item, data, groupbyMap);
                                //格式处理列值
                                if (typeof column.formatter !== 'undefined') {
                                    //格式入参值 {值,本行,索引,合并行数量}
                                    _value = calculateObjectValue(column, column.formatter, [_value, item, i, groupbyMap.get(item[column.groupByField] + column.field + item[options.parentColumn])], _value)
                                }
                                //处理编辑列
                                if (typeof column.editable !== 'undefined') {
                                    tr.attr('data-id', item[options.idField]);
                                    _value = calculateEditable(_value, column, item);
                                }
                                //处理列大小
                                if (typeof column.width !== 'undefined') {
                                    td.attr('width', column.width)
                                }
                                //处理列样式
                                if (typeof column.class !== 'undefined') {
                                    td.addClass(column.class)
                                }
                                //合并行
                                td.attr("rowspan", groupbyMap.get(item[column.groupByField] + column.field + item[options.parentColumn]));
                                td.html(_value);
                                tr.append(td);
                            }
                        } else {
                            //格式处理列值
                            if (typeof column.formatter !== 'undefined') {
                                _value = calculateObjectValue(column, column.formatter, [_value, item, i], _value)
                            }
                            //处理列编辑
                            if (typeof column.editable !== 'undefined') {
                                tr.attr('data-id', item[options.idField]);
                                _value = calculateEditable(_value, column, item);
                            }
                            //处理列大小
                            if (typeof column.width !== 'undefined') {
                                td.attr('width', column.width)
                            }
                            //处理列样式
                            if (typeof column.class !== 'undefined') {
                                td.addClass(column.class)
                            }
                            td.html(_value);
                            tr.append(td);
                        }
                    });
                    tbody.append(tr);
                    target.getChildNodes(data, item, nowParentIndex, tbody, newlevel)
                }
            }
        };
        //删除节点
        target.removeNode = function (item) {
            $('.treegrid-' + item.id).remove();
        }

        target.addClass('table ');

        if (options.striped) {
            target.addClass('table-striped');
        }
        if (options.bordered) {
            target.addClass('table-bordered');
        }
        if (options.url) {
            $.ajax({
                type: options.type,
                url: options.url,
                data: options.ajaxParams,
                cache: false,
                dataType: "JSON",
                success: function (data, textStatus, jqXHR) {
                    if (data.length > 0) {
                        options.data = data;
                        target.initBody(options.data);
                        calculateObjectValue(options, options.onLoadSuccess, [data]);
                    } else {
                        target.noDataShow();
                    }
                    if (!options.expandAll) {
                        target.treegrid('collapseAll');
                    }
                },
                beforeSend: function () {
                    layer.load(1, {
                        shade: [0.3, '#fff'] //0.1透明度的白色背景
                    });
                },
                complete: function () {
                    layer.closeAll('loading');
                }
            });
        } else {
            if (options.data) {
                if (Array.isArray(options.data)) {
                    if (options.data.length > 0) {
                        layer.load(1, {
                            shade: [0.3, '#fff'] //0.1透明度的白色背景
                        });
                        target.initBody(options.data);
                        layer.closeAll('loading');
                        calculateObjectValue(options, options.onLoadSuccess, [options.data]);
                    } else {
                        layer.load(1, {
                            shade: [0.3, '#fff'] //0.1透明度的白色背景
                        });
                        target.noDataShow();
                        layer.closeAll('loading');
                    }
                }
            }
        }
        return target;
    };

    /**
     * 字符替换
     * @param str
     * @returns {*}
     */
    var sprintf = function (str) {
        var args = arguments,
            flag = true,
            i = 1;

        str = str.replace(/%s/g, function () {
            var arg = args[i++];

            if (typeof arg === 'undefined') {
                flag = false;
                return '';
            }
            return arg;
        });
        return flag ? str : '';
    };

    /**
     * 编辑列值渲染
     * @param value
     * @param column
     * @param row
     * @returns {*}
     */
    var calculateEditable = function (value, column, row) {
        var _dont_edit_formatter = false;
        if (column.editable.hasOwnProperty('noeditFormatter')) {
            _dont_edit_formatter = column.editable.noeditFormatter(value, row, column);
        }
        if (_dont_edit_formatter === false) {
            return ['<a href="javascript:void(0)"',
                ' data-name="' + column.field + '"',
                ' data-pk="' + row.id + '"',
                ' data-value="' + value + '"',
                '>' + '</a>'
            ].join('');
        } else {
            return value;
        }


    }

    /**
     *
     * @param self 自身(列)
     * @param field 分组属性
     * @param parentField 父属性
     * @param args 行
     * @param sources 全部数据
     * @param map map去重
     * @returns {number}
     */
        //计算分组
    var calculateGroupby = function (self, field, parentField, args, sources, map) {
            var total = 0;
            var rowspan = 0;
            if (Array.isArray(sources)) {
                //循环所有数据，查询合并项目
                $.each(sources, function (i, item) {
                    //分组名称相同并且父类代码相同合并列
                    if (item[field] === args[field] && item[parentField] === args[parentField]) {
                        if (typeof self.isCovered !== 'undefined' && self.isCovered) {
                            total = item[self.field];
                        } else {
                            total += item[self.field];
                        }
                        rowspan += 1;
                    }
                });
                map.put(args[field] + self.field + args[parentField], rowspan);
            }
            return total;
        }

    //计算对象值
    var calculateObjectValue = function (self, name, args, defaultValue) {
        var func = name;

        if (typeof name === 'string') {
            // support obj.func1.func2
            var names = name.split('.');

            if (names.length > 1) {
                func = window;
                $.each(names, function (i, f) {
                    func = func[f];
                });
            } else {
                func = window[name];
            }
        }
        if (typeof func === 'object') {
            return func;
        }
        if (typeof func === 'function') {
            return func.apply(self, args || []);
        }
        if (!func && typeof name === 'string' && sprintf.apply(this, [name].concat(args))) {
            return sprintf.apply(this, [name].concat(args));
        }
        return defaultValue;
    };

    var isVarEmpty = function (aObj) {
        if ((aObj === undefined || aObj === "undefined" || aObj === "" || aObj === null)) {
            return true;
        }
        return false;
    }

    /**
     * 控件方法
     * @type {{
     * getAllNodes: (function(*): (*|void)),  获取当前所有数据
     * expand2: $.fn.treegridData.methods.expand2, 展开2级目录
     * updateCell: $.fn.treegridData.methods.updateCell,  更新列
     * removeRow: $.fn.treegridData.methods.removeRow 删除行
     * }}
     */
    $.fn.treegridData.methods = {
        /**
         * 获取当前所有节点
         * @param target
         * @returns {*|void}
         */
        getAllNodes: function (target) {
            return target.treegrid('getAllNodes');
        },
        /**
         * 展开2级
         * @param target
         */
        expand2: function (target) {
            target.treegrid('getAllNodes').each(function () {
                if ($(this).treegrid('getDepth') < 2) {
                    $(this).treegrid('expand');
                }
            })
        },
        /**
         * 通过唯一ID查询记录信息
         * @param target
         * @param param
         * @returns {*}
         */
        getRowByUniqueId: function (target, param) {
            if (typeof param !== 'object')
                return;
            if (isVarEmpty(param.id))
                return;
            var data = target.getData(), row;
            for (var i = 0; i < data.length; i++) {
                if (param.id === data[i][target.options.idField]) {
                    row = data[i];
                    break;
                }
            }
            return row;
        },
        /**
         * 根据选中行获取选中值
         */
        getSelect: function (target) {
            var selectRow;
            var data = target.getData();
            var selectId = target.find('.action').data('id');
            if (isVarEmpty(selectId)) {
                return;
            }
            for (var i = 0; i < data.length; i++) {
                if (selectId === data[i][target.options.idField]) {
                    selectRow = data[i];
                    break;
                }
            }
            return selectRow;

        },
        /**
         * 更新列
         * @param target
         * @param param
         */
        updateCell: function (target, param) {
            if (typeof param !== 'object')
                return;
            if (isVarEmpty(param.rowId) || isVarEmpty(param.field) || isVarEmpty(param.value))
                return;
            var data = target.getData(), row;
            for (var i = 0; i < data.length; i++) {
                if (data[i][target.options.idField] === param.rowId) {
                    row = data[i];
                    break;
                }
            }
            row[param.field] = param.value;
            //界面更新
            var ele = target.find("tr[row-id$='" + param.rowId + "']").children();
            //更新索引
            var indexCell = 0;
            $.each(target.options.columns, function (index, column) {
                if (column.field == param.field)
                    indexCell = index;
            });
            $(ele[indexCell]).html(param.value);

        },
        removeRow: function (target, param) {

        }
        //组件的其他方法也可以进行类似封装........
    };


    $.fn.treegridData.defaults = {
        id: 'id',
        parentColumn: 'parentId',
        data: [],    //构造table的数据集合
        type: "GET", //请求数据的ajax类型
        url: null,   //请求数据的ajax的url
        ajaxParams: {}, //请求数据的ajax的data属性
        expandColumn: null,//在哪一列上面显示展开按钮
        thead: null, //指定表头
        expandAll: true,  //是否全部展开
        striped: false,   //是否各行渐变色
        bordered: false,  //是否显示边框
        idField: 'id', //数据唯一标识
        columns: [],
        expanderExpandedClass: 'glyphicon glyphicon-chevron-down',//展开的按钮的图标
        expanderCollapsedClass: 'glyphicon glyphicon-chevron-right',//缩起的按钮的图标
        rowStyle: function (row, index) { //行色彩
            return {};
        },
        onLoadSuccess: function (data) {
            return false;
        },
        indent: 50,
        editable: false,
        onEditableInit: function () {
            return false;
        },
        onEditableSave: function (field, row, oldValue, $el) {
            return false;
        },
        onEditableShown: function (field, row, $el, editable) {
            return false;
        },
        onEditableHidden: function (field, row, $el, reason) {
            return false;
        },

    };


})(jQuery);