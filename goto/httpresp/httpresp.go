package httpresp

import (
	"fmt"
	"net/http"
	"strings"
)

type Error struct {
	code  int
	inner error
}

func (e *Error) Error() string {
	return fmt.Sprintf("(%d) %v", e.code, e.inner)
}

func (e *Error) Write(w http.ResponseWriter) {
	w.WriteHeader(e.code)
	fmt.Fprintf(w, "%v", e.inner)
}

func NewError(code int, e error) *Error {
	return &Error{
		code:  code,
		inner: e,
	}
}

func Errorf(code int, f string, a ...interface{}) *Error {
	return &Error{
		code:  code,
		inner: fmt.Errorf(f, a...),
	}
}

type Response struct {
	inner []string
}

func New(in string) *Response {
	return FromSlice([]string{in})
}

func Format(f string, a ...interface{}) *Response {
	return New(fmt.Sprintf(f, a...))
}

func FromSlice(in []string) *Response {
	return &Response{inner: in}
}

func (r *Response) Append(line string) *Response {
	var sl []string
	if r != nil {
		sl = r.inner
	}

	sl = append(sl, line)
	return FromSlice(sl)
}

func (r *Response) Appendf(f string, a ...interface{}) *Response {
	return r.Append(fmt.Sprintf(f, a...))
}

func (r *Response) AddNL() *Response {
	return r.Append("")
}

func (a *Response) Join(b *Response) *Response {
	var sla []string
	var slb []string
	if a != nil {
		sla = a.inner
	}
	if b != nil {
		slb = b.inner
	}
	return FromSlice(append(sla, slb...))
}

func (r *Response) Write(w http.ResponseWriter) {
	fmt.Fprint(w, strings.Join(r.inner, "\n"))
}
