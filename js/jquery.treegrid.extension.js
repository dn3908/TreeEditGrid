(function ($) {
    "use strict";

    var getItemField = function (item, field) {
        var value = item;

        if (typeof field !== 'string' || item.hasOwnProperty(field)) {
            return item[field];
        }
        var props = field.split('.');
        for (var p in props) {
            if (props.hasOwnProperty(p)) {
                value = value && value[props[p]];
            }
        }
        return value;
    };

    var isVarEmpty = function (aObj) {
        if ((aObj === undefined || aObj === "undefined" || aObj === "" || aObj === null)) {
            return true;
        }
        return false;
    }

    // it only does '%s', and return '' when arguments are undefined
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
     * 计算对象值
     * @param {*} self
     * @param {*} name
     * @param {*} args
     * @param {*} defaultValue
     */
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


    /**
     * 初始化可编辑列
     * @param {*} value  值
     * @param {*} column  列
     * @param {*} row 行
     * @param {*} options 可編輯列设置属性
     */
    var calculateEditable = function (value, column, row, options, idField) {
        var _dont_edit_formatter = false;
        if (options.hasOwnProperty('noeditFormatter')) {
            _dont_edit_formatter = options.noeditFormatter(value, row, column);
        }
        if (_dont_edit_formatter === false) {
            return ['<a href="javascript:void(0)"',
                ' data-name="' + column.field + '"',
                ' data-pk="' + row[idField] === 'undefined' ? '' : row[idField] + '"',
                ' data-value="' + value + '"',
                '>' + '</a>'
            ].join('');
        } else {
            return value;
        }


    }


    var TreegridData = function (el, options) {
        this.options = options;
        this.$el = $(el);
        //分組map
        this.groupbyMap = new Map();
        this.init();
    };

    /**
     * 初始化组装
     */
    TreegridData.prototype.init = function () {
        this.initContainer();
        this.initTable();
        this.initHeader();
        this.initData();
        this.initBody();
        this.initEvent();
        this.initServer();
    };
    /**
     * 初始化容器
     */
    TreegridData.prototype.initContainer = function () {
        this.$container = $([
            '<div class="treegridData-table">',
            '<div class="treegridData-table-container">',
            '<div class="treegridData-table-header"></div>',
            '<div class="treegridData-table-body"></div>',
            '</div>',
            '</div>'
        ].join(''));
        this.$container.insertAfter(this.$el);
        this.$tableContainer = this.$container.find('.treegridData-table-container');
        this.$tableHeader = this.$container.find('.treegridData-table-header');
        this.$tableBody = this.$container.find('.treegridData-table-body');


        this.$tableBody.append(this.$el);
        this.$container.after('<div class="clearfix"></div>');
        this.$el.addClass("table-hover");
        this.$el.addClass(this.options.tableCss);
        if (this.options.striped) {
            this.$el.addClass('table-striped');
        }
        if (this.options.bordered) {
            this.$el.addClass('table-bordered');
        }
    }

    // http://jsfiddle.net/wenyi/47nz7ez9/3/
    var setFieldIndex = function (columns) {
        var i, j, k,
            totalCol = 0,
            flag = [];

        for (i = 0; i < columns[0].length; i++) {
            totalCol += columns[0][i].colspan || 1;
        }

        for (i = 0; i < columns.length; i++) {
            flag[i] = [];
            for (j = 0; j < totalCol; j++) {
                flag[i][j] = false;
            }
        }

        for (i = 0; i < columns.length; i++) {
            for (j = 0; j < columns[i].length; j++) {
                var r = columns[i][j],
                    rowspan = r.rowspan || 1,
                    colspan = r.colspan || 1,
                    index = $.inArray(false, flag[i]);

                if (colspan === 1) {
                    r.fieldIndex = index;
                    // when field is undefined, use index instead
                    if (typeof r.field === 'undefined') {
                        r.field = index;
                    }
                }

                for (k = 0; k < rowspan; k++) {
                    flag[i + k][index] = true;
                }
                for (k = 0; k < colspan; k++) {
                    flag[i][index + k] = true;
                }
            }
        }
    };


    /**
     * 初始化表
     *
     */
    TreegridData.prototype.initTable = function () {
        var html = [], that = this, columns = [];
        this.$header = this.$el.find('>thead');
        //是否存在表头
        if (!this.$header.length) {
            //不存在创建一个
            this.$header = $('<thead></thead>').appendTo(this.$tableHeader);
        }

        //存在表头 获取表头列信息
        this.$header.find('tr').each(function () {
            var column = [];
            $(this).find('th').each(function () {
                column.push($.extend({}, {
                    title: $(this).html(),
                    'class': $(this).attr('class'),
                    titleTooltip: $(this).attr('title'),
                    rowspan: $(this).attr('rowspan') ? +$(this).attr('rowspan') : undefined,
                    colspan: $(this).attr('colspan') ? +$(this).attr('colspan') : undefined
                }));
            });
            columns.push(column);
        });

        this.columns = [];
        this.headerColumns = [];

        //分解緩存列信息增加列索引
        if (Array.isArray(columns) && columns.length !== 0) {
            setFieldIndex(columns);
        }
        $.each(columns, function (i, columnsInfo) {
            $.each(columnsInfo, function (j, column) {
                $.each(that.options.columns, function (z, columnInfo) {
                    if (column.fieldIndex == z) {
                        //深度拷贝
                        $.extend(true, column, columnInfo);
                        that.columns[column.fieldIndex] = column;
                    }

                });
            })
        });
        //所有列信息
        this.headerColumns = columns;
    }


    TreegridData.prototype.initHeader = function () {
        var that = this,
            html = [];
        this.header = {
            fields: [],
            styles: [],
            classes: [],
            formatters: [],
            editables: [],
            groupByFields: []

        };
        $.each(this.headerColumns, function (i, columns) {
            html.push('<tr>');
            $.each(columns, function (j, column) {
                var text = column.title,
                    halign = '', // header align style
                    align = '', // body align style
                    style = '',
                    class_ = sprintf(' class="%s"', column['class']),
                    unitWidth = 'px',
                    width = column.width;

                if (column.width && typeof column.width === 'string') {
                    width = column.width.replace('%', '').replace('px', '');
                }
                if (column['class']) {
                    class_ = sprintf(' class="%s"', column['class']);
                }
                halign = sprintf('text-align: %s; ', column.halign ? column.halign : column.align);
                align = sprintf('text-align: %s; ', column.align);
                style = sprintf('vertical-align: %s; ', column.valign);
                style += sprintf('width: %s', !width ?
                    '36px' : (width ? width + unitWidth : undefined));



                //具有索引的列信息
                if (typeof column.fieldIndex !== 'undefined') {
                    that.header.fields[column.fieldIndex] = column.field;
                    that.header.styles[column.fieldIndex] = align + style;
                    that.header.classes[column.fieldIndex] = class_;
                    that.header.formatters[column.fieldIndex] = column.formatter;
                    that.header.editables[column.fieldIndex] = column.editable;
                    that.header.groupByFields[column.fieldIndex] = column.groupByField;
                }

                html.push('<th',
                    sprintf(' %s', class_),
                    sprintf(' style="%s"', halign + align + style),
                    sprintf(' rowspan="%s"', column.rowspan),
                    sprintf(' colspan="%s"', column.colspan),
                    '><div>');

                html.push(text);
                html.push('</div></th>');

            });
            html.push('</tr>');
        });
        this.$header.html(html.join(''));

        //是否固定表头
        if (this.options.fixThead) {
            /*******固定的逻辑基本就下面这些*********/
            var scroll_y = 0;
            this.$tableBody.css({ maxHeight: "768px", overflowY: "auto" });
            this.$header.find("tr").css({ backgroundColor: "aliceblue" });
            this.$tableBody.on("scroll", function (e) {
                //垂直滚动固定头
                if (this.scrollTop != scroll_y) {
                    scroll_y = this.scrollTop;
                    this.querySelector("thead").style.transform = "translate3d(0," + this.scrollTop + "px,.1px)";
                }
            });
        }

    }
    /**
     * @description: 初始化数据
     * @param {type}
     * @return:
     */
    TreegridData.prototype.initData = function (data, type) {
        if (type === 'append') {
            this.data = this.data.concat(data);
        } else if (type === 'prepend') {
            this.data = [].concat(data).concat(this.data);
        } else {
            this.data = data || this.options.data;
        }

        if (type === 'append') {
            this.options.data = this.options.data.concat(data);
        } else if (type === 'prepend') {
            this.options.data = [].concat(data).concat(this.options.data);
        } else {
            this.options.data = this.data;
        }

    }

    /**
     * @description: 无法找到数据显示
     * @param {type}
     * @return:
     */
    TreegridData.prototype.noDataShow = function (this_) {
        var html = [];
        this_.$body = this_.$el.find('>tbody');
        html.push('<tr>');
        html.push('<td ',
            sprintf(' %s', sprintf(' colspan="%s"', this_.columns.length)),
            sprintf(' %s', sprintf(' style="%s"', 'text-align:center')),
            '>',
            '无法找到数据',
            '</td>'
        );
        html.push('</tr>');
        this_.$body.html(html.join(' '));
    }


    /**
     * @description: 初始化表体
     * @param {type}
     * @return:
     */
    TreegridData.prototype.initBody = function () {
        var that = this,
            data = this.getData(), j = 0;
        this.$body = this.$el.find('>tbody');
        if (!this.$body.length) {
            this.$body = $('<tbody></tbody>').appendTo(this.$el);
        }
        if (this.options.groupBy) {
            //初始化分组信息
            this.initGroup();
        }

        //优化，初始化一个片段，片段不会引发前端渲染，因为所有的节点会被一次插入到文档中，而这个操作仅发生一个重渲染的操作
        var trFragments = $(document.createDocumentFragment());
        //获取根目录
        var roots = this.getRootNodes(data);
        var level = 1;
        for (var i = 0, m = roots.length; i < m; i++) {
            var item = roots[i], tr;
            //判断是否分组
            if (this.options.groupBy) {
                tr = this.initGroupRow(item, i, false, 0);
            } else {
                tr = this.initRow(item, i, false, 0);
            }

            if (tr) {
                trFragments.append(tr);
            }
            this.getChildNodes(item, (j + i), level, trFragments);
        }
        this.$body.html(trFragments);

        //没有数据展示
        if ((data.length === 0 || this.options.data.length === 0)) {
            this.noDataShow(this);
        }

        //整合treegrid
        this.$el.treegrid({
            expanderExpandedClass: this.options.expanderExpandedClass,
            expanderCollapsedClass: this.options.expanderCollapsedClass
        });
    }

    /**
     * 初始化分组
     */
    TreegridData.prototype.initGroup = function () {
        var that = this,
            data = this.getData();
        //清空分组信息
        this.groupbyMap.clear();
        $.each(data, function (index, row) {
            $.each(that.options.columns, function (index, column) {
                //列具有分组属性
                if (column.groupByField) {
                    that.calculateGroupby(column, row, column.groupByField, that);
                }
            });
        })
    }

    /**
     * 计算分组
     * @param column 自身列
     * @param row  行
     * @param groupByField 分组属性
     */
    TreegridData.prototype.calculateGroupby = function (column, row, groupByField, this_) {
        var group_ = {
            total: row[column.field],
            isUse: false,
            children: []
        },
            //分组名称相同并且父类代码相同的列进行行合并
            key_ = row[groupByField] + row[this_.options.parentColumn] + column.field

        if (this_.groupbyMap.has(key_)) {
            group_ = this_.groupbyMap.get(key_);
            if (!column.isCovered) {
                group_.total += row[column.field];
            }
            group_.children.push(row);
            this_.groupbyMap.delete(key_);
            this_.groupbyMap.set(key_, group_);
            return;
        }
        group_.children.push(row);
        this_.groupbyMap.set(key_, group_);
    }


    /**
     * @description: 递归生成子项
     * @param parentNode, 父节点
     * @param parentIndex,  父索引
     * @param level, 层级
     * @param parentDom 父级目录
     */
    TreegridData.prototype.getChildNodes = function (parentNode, parentIndex, level, parentDom) {
        var that = this, data = this.getData();
        for (var i = 0, m = data.length; i < m; i++) {
            var node = data[i];
            if (node[that.options.parentColumn] == parentNode[that.options.id]) {
                var nowParentIndex = (parentIndex + "" + i);
                var newlevel = level + 1, tr;
                //判断是否分组
                if (this.options.groupBy) {
                    tr = this.initGroupRow(node, nowParentIndex, parentIndex + "", newlevel);
                } else {
                    tr = this.initRow(node, nowParentIndex, parentIndex + "", newlevel);
                }
                if (tr) {
                    parentDom.append(tr);
                }
                this.getChildNodes(node, nowParentIndex, newlevel, parentDom);
            }

        }
    }


    /**
     * @description: 插入分组行
     * @param item  行
     * @param index 索引
     * @param parentIndex 父类索引
     * @param level 层数
     * @return:
     */
    TreegridData.prototype.initGroupRow = function (item, index, parentIndex, level) {
        var that = this,
            html = [],
            style = {}, class_ = '',
            indent = this.options.indent,
            style = calculateObjectValue(this.options, this.options.rowStyle, [item, index], style),
            isUser_ = false,
            children = [];
        //获取当前分组集合
        $.each(this.options.columns, function (colindex, column) {
            if (column.groupByField) {
                children = that.groupbyMap.get(item[column.groupByField] + item[that.options.parentColumn] + column.field).children;
                isUser_ = that.groupbyMap.get(item[column.groupByField] + item[that.options.parentColumn] + column.field).isUse;
                return false
            }

        })

        $.each(children, function (childrenIndex, row) {
            if (parentIndex) {
                class_ = 'treegrid-' + (index) + ' treegrid-parent-' + parentIndex;
            } else {
                class_ = 'treegrid-' + (index);
            }
            if (isUser_) {
                return true;
            }
            html.push('<tr',
                sprintf(' class="%s"', class_),
                sprintf(' style="%s"', style ? style : ''),
                sprintf(' row-id="%s"', row[that.options.idField]),
                sprintf(' data-index="%s"', (index + "_" + childrenIndex)),
                sprintf(' data-level="%s"', level),
                '>'
            );

            $.each(that.options.columns, function (colindex, column) {
                var text = '',
                    value_ = getItemField(row, column.field),
                    value = '',
                    id_ = '',
                    rowspan_ = 1,
                    colspan_ = '',
                    class_ = '',
                    title_ = '',
                    style_ = '',
                    editable_ = '',
                    group_ = that.groupbyMap.get(row[column.groupByField] + row[that.options.parentColumn] + column.field);

                if (index === 0) {
                    style_ = "padding-left:" + (indent * level) + "px;";
                }
                if (column.style) {
                    style_ += column.style;
                }
                if (column.field) {
                    id_ = sprintf(' id="%s"', column.field);
                }
                if (column.groupByField) {
                    rowspan_ = sprintf(' rowspan="%s"', group_.children.length);
                }
                if (column.colspan) {
                    colspan_ = sprintf(' colspan="%s"', column.colspan);
                }
                if (column.classes) {
                    class_ = sprintf(' class="%s"', column.classes);
                }
                if (column.title) {
                    title_ = sprintf(' title="%s"', column.title);
                }
                if (column.formatter) {
                    value = calculateObjectValue(column, column.formatter, [value_, item, index, group_.children.length], value_)
                } else {
                    value = value_;
                }
                //是否編輯
                if (column.editable) {
                    editable_ = sprintf(' data-id="%s"', item[that.options.idField]);
                    value = calculateEditable(value, column, item, that.options);
                }
                //空值默认显示
                value = typeof value === 'undefined' || value === null ?
                    that.options.emptyValue : value;

                //是否分组列
                if (column.groupByField) {
                    if (!group_.isUse) {
                        //标识已经执行分组
                        group_.isUse = true;
                        html.push('<td ',
                            sprintf(' %s', id_),
                            sprintf(' %s', sprintf(' style="%s"', style_)),
                            sprintf(' %s', class_),
                            sprintf(' %s', rowspan_),
                            sprintf(' %s', colspan_),
                            sprintf(' %s', title_),
                            sprintf(' %s', editable_),
                            '>',
                            value,
                            '</td>'
                        );
                    }
                } else {
                    html.push('<td ',
                        sprintf(' %s', id_),
                        sprintf(' %s', sprintf(' style="%s"', style_)),
                        sprintf(' %s', class_),
                        sprintf(' %s', rowspan_),
                        sprintf(' %s', colspan_),
                        sprintf(' %s', title_),
                        sprintf(' %s', editable_),
                        '>',
                        value,
                        '</td>'
                    );
                }

            });
        });
        html.push('</tr>');
        return html.join(' ');
    }

    /**
     * 插入行
     */
    TreegridData.prototype.initRow = function (item, index, parentIndex, level) {
        var that = this,
            html = [],
            style = {}, class_ = '',
            indent = this.options.indent,
            style = calculateObjectValue(this.options, this.options.rowStyle, [item, index], style);

        //父类索引存在
        if (parentIndex) {
            class_ = 'treegrid-' + (index) + ' treegrid-parent-' + parentIndex;
        } else {
            class_ = 'treegrid-' + (index);
        }
        html.push('<tr',
            sprintf(' class="%s"', class_),
            sprintf(' style="%s"', style ? style : ''),
            sprintf(' row-id="%s"', item[this.options.idField]),
            sprintf(' data-index="%s"', index),
            sprintf(' data-level="%s"', level),
            '>'
        );
        $.each(this.header.fields, function (j, field) {
            var value_ = getItemField(item, field),
                value = '',
                id_ = '',
                class_ = '',
                csses = [],
                style_ = '',
                editable_ = '',
                column = that.columns[j];

            if (j === 0) {
                style_ = "padding-left:" + (indent * level) + "px;";
            }
            if (that.header.styles[j]) {
                style = sprintf('style="%s"', csses.concat(that.header.styles[j]).concat(style_).join('; '));
            }
            if (that.header.classes[j]) {
                class_ = sprintf(' class="%s"', that.header.classes[j]);
            }
            if (that.header.formatters[j]) {
                value = calculateObjectValue(column, that.header.formatters[j], [value_, item, index], value_)
            } else {
                value = value_;
            }
            //是否編輯
            if (that.header.editables[j]) {
                editable_ = sprintf(' data-id="%s"', item[that.options.idField]);
                value = calculateEditable(value, column, item, that.header.editables[j], that.options.idField);

            }
            //空值默认显示
            value = typeof value === 'undefined' || value === null ?
                that.options.emptyValue : value;
            html.push('<td ',
                sprintf(' %s', id_),
                sprintf(' %s', style),
                sprintf(' %s', class_),
                sprintf(' %s', editable_),
                '>',
                value,
                '</td>'
            );

        });
        html.push('</tr>');

        return html.join(' ');
    }


    /**
     * @description: ajax初始化
     * @param {type}
     * @return:
     */
    TreegridData.prototype.initServer = function (query, url) {
        var that = this,
            params = this.options.ajaxParams,
            request;

        if (!(url || this.options.url)) {
            return;
        }

        request = {
            type: this.options.type,
            url: url || this.options.url,
            data: this.options.ajaxParams,
            contentType: this.options.contentType,
            success: function (data) {
                if (data.length > 0) {
                    //触发加载成功事件
                    calculateObjectValue(that.options, that.options.onLoadSuccess, [data]);
                    that.load(data);
                }
                if (!that.options.expandAll) {
                    that.collapseAll();
                }
            },
            beforeSend: function () {
                layer.load(1, {
                    shade: [0.3, '#fff'] //0.1透明度的白色背景
                });
            },
            complete: function () {
                layer.closeAll('loading');
            },
            error: function (res) {
                layer.closeAll('loading');
            }
        };

        if (this._xhr && this._xhr.readyState !== 4) {
            this._xhr.abort();
        }
        this._xhr = $.ajax(request);
    }


    /**
     * @description: 重新加载
     * @param {type}
     * @return:
     */
    TreegridData.prototype.load = function (data) {
        this.initData(data);
        this.initBody();
        this.initEvent();
    }

    /**
     * @description: 初始化事件
     * @param {type}
     * @return:
     */
    TreegridData.prototype.initEvent = function () {
        var that = this, style = "";
        //主要判断是否设置行色彩函数
        style = calculateObjectValue(this.options, this.options.rowStyle, ["", ""], style);
        if (!style) {
            //绑定选中行变色
            this.$tableBody.find('tr').on('click', function () {
                $(this).addClass('action').css("background-color", "#e2f5ff")     //为选中项添加高亮
                    .siblings().removeClass('action').css("background-color", 'white')//去除其他项的高亮形式
                    .end();
            });
        }

        //初始化编辑事件
        if (!this.options.editable) {
            return;
        }
        //设置data-pk值
        this.$tableBody.find("tr").each(function (index, item) {
            var id = $(item).attr("data-id");
            $(item).find("td").find('a').each(function (_index, _item) {
                var name = $(_item).attr("data-name");
                $(_item).attr("data-pk", name + id);
            });
        });

        $.each(this.options.columns, function (i, column) {
            that.$tableBody.find('a[data-name="' + column.field + '"]').editable(column.editable)
                .off('save').on('save', function (e, params) {
                    var data = that.getData(),
                        idField = $(this).parents('td[data-id]').data('id'),
                        row;
                    for (var i = 0, m = data.length; i < m; i++) {
                        if (idField == data[i][that.options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    var oldValue = row[column.field];
                    row[column.field] = params.submitValue;
                    that.trigger($(this), 'onEditableSave', [column.field, row, oldValue, $(this)]);
                });
            that.$tableBody.find('a[data-name="' + column.field + '"]').editable(column.editable)
                .off('shown').on('shown', function (e, editable) {
                    var data = that.getData(),
                        idField = $(this).parents('td[data-id]').data('id'),
                        row;
                    for (var i = 0, m = data.length; i < m; i++) {
                        if (idField == data[i][that.options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    that.trigger($(this), 'onEditableShown', [column.field, row, $(this)]);
                });
            that.$tableBody.find('a[data-name="' + column.field + '"]').editable(column.editable)
                .off('hidden').on('hidden', function (e, reason) {
                    var data = that.getData(),
                        idField = $(this).parents('td[data-id]').data('id'),
                        row;
                    for (var i = 0, m = data.length; i < m; i++) {
                        if (idField == data[i][that.options.idField]) {
                            row = data[i];
                            break;
                        }
                    }
                    that.trigger($(this), 'onEditableHidden', [column.field, row, $(this)]);
                });

        });
        that.trigger($(this), 'onEditableInit');

    }

    /**
     * @description:  销毁treegridDate
     * @param {type}
     * @return:
     */
    TreegridData.prototype.destroy = function () {
        this.$el.insertBefore(this.$container);
        this.$container.next().remove();
        this.$container.remove();
    };

    /**
     * 事件主动触发
     */
    TreegridData.prototype.trigger = function (self, name, args) {
        this.options[name].apply(this.options, args);
        this.$el.trigger($.Event(name), args);
    }

    /**
     * @description: 获取根目录
     * @param {type}
     * @return:
     */
    TreegridData.prototype.getRootNodes = function (data) {
        return data.filter(node => isVarEmpty(node[this.options.parentColumn]));
    };

    /**
     * @description: 获取全部数据
     * @param {type}
     * @return:
     */
    TreegridData.prototype.getData = function () {
        return this.options.data;
    };

    /**
     * @description:  获取全部节点
     * @param {type}
     * @return:
     */
    TreegridData.prototype.getAllNodes = function () {
        return this.$el.treegrid('getAllNodes');
    };

    /**
     * @description: 展开二级目录
     * @param {type}
     * @return:
     */
    TreegridData.prototype.expand2 = function () {
        this.$el.treegrid('getAllNodes').each(function () {
            if ($(this).treegrid('getDepth') < 2) {
                $(this).treegrid('expand');
            }
        })
    };

    /**
     * @description: 折叠所有
     * @param {type}
     * @return:
     */
    TreegridData.prototype.collapseAll = function () {
        this.$el.treegrid('collapseAll');
    };

    /**
     * @description: 展开所有
     * @param {type}
     * @return:
     */
    TreegridData.prototype.expandAll = function () {
        this.$el.treegrid('expandAll');
    };

    /**
     * @description: 根据唯一ID获取数据
     * @param {type}
     * @return:
     */
    TreegridData.prototype.getRowByUniqueId = function (param) {
        if (typeof param !== 'object')
            return;
        if (isVarEmpty(param.id))
            return;
        var that = this, data = this.getData(), row;
        for (var i = 0, m = data.length; i < m; i++) {
            if (param.id === data[i][that.options.idField]) {
                row = data[i];
                break;
            }
        }
        return row;

    }

    /**
     * @description: 获取选中数据
     * @param {type}
     * @return:
     */
    TreegridData.prototype.getSelect = function () {
        var selectRow,
            data = this.getData();
        var that = this;
        var selectId = this.$body.find('.action').data('id');
        if (isVarEmpty(selectId)) {
            return;
        }
        for (var i = 0; i < data.length; i++) {
            if (selectId === data[i][that.options.idField]) {
                selectRow = data[i];
                break;
            }
        }
        return selectRow;

    }

    /**
     * @description: 更新列值
     * @param param 参数 {rowId:行ID,field:列属性,value:列值}
     * @return:
     */
    TreegridData.prototype.updateCell = function (param) {
        if (typeof param !== 'object')
            return;
        if (isVarEmpty(param.rowId) || isVarEmpty(param.field) || isVarEmpty(param.value))
            return;
        var data = this.getData(), that = this, row;
        for (var i = 0; i < data.length; i++) {
            if (data[i][that.options.idField] === param.rowId) {
                row = data[i];
                break;
            }
        }
        row[param.field] = param.value;
        //界面更新
        var ele = this.$body.find("tr[row-id$='" + param.rowId + "']").children();
        //更新索引
        var indexCell = 0;
        $.each(this.options.columns, function (index, column) {
            if (column.field == param.field)
                indexCell = index;
        });
        $(ele[indexCell]).html(param.value);

    }


    /**
     * 所有方法
     */
    var allowedMethods = [
        'getAllNodes', 'expand2', 'getRowByUniqueId', 'getSelect', 'updateCell', 'load', 'destroy', 'getData', 'collapseAll', 'expandAll'

    ];

    $.fn.treegridData = function (option) {
        var value,
            //获取参数
            args = Array.prototype.slice.call(arguments, 1);

        var $this = $(this),
            data = $this.data('treegridData.table'),
            options = $.extend({}, $.fn.treegridData.defaults, $this.data(),
                typeof option === 'object' && option);
        //如果是方法
        if (typeof option === 'string') {
            if ($.inArray(option, allowedMethods) < 0) {
                throw new Error("Unknown method: " + option);
            }

            if (!data) {
                return;
            }
            //执行方法
            value = data[option].apply(data, args);

            if (option === 'destroy') {
                $this.removeData('treegridData.table');
            }
        }

        if (!data) {
            //不存在treegriddata，初始化treegriddata
            $this.data('treegridData.table', (data = new TreegridData(this, options)));
        }

        return typeof value === 'undefined' ? this : value;
    };

    $.fn.treegridData.defaults = {
        id: 'id',
        parentColumn: 'parentId',
        data: [],    //构造table的数据集合
        type: "GET", //请求数据的ajax类型
        contentType: 'application/json',
        url: null,   //请求数据的ajax的url
        ajaxParams: {}, //请求数据的ajax的data属性
        expandColumn: null,//在哪一列上面显示展开按钮
        thead: null, //指定表头
        expandAll: true,  //是否全部展开
        striped: false,   //是否各行渐变色
        bordered: false,  //是否显示边框
        idField: 'id', //数据唯一标识
        columns: [[]],
        tableCss: null,
        fixThead: false, //是否固定表头
        groupBy: false, //是否分组
        emptyValue: "-",
        expanderExpandedClass: 'glyphicon glyphicon-chevron-down',//展开的按钮的图标
        expanderCollapsedClass: 'glyphicon glyphicon-chevron-right',//缩起的按钮的图标
        rowStyle: function (row, index) { //行色彩
            return false;
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
        }
    };

})(jQuery);